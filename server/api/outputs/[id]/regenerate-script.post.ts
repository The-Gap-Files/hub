import { prisma } from '../../../utils/prisma'
import { providerManager } from '../../../services/providers'
import { costLogService } from '../../../services/cost-log.service'
import { calculateLLMCost } from '../../../constants/pricing'
import { getVisualStyleById } from '../../../constants/visual-styles'
import { getScriptStyleById } from '../../../constants/script-styles'
import { getClassificationById } from '../../../constants/intelligence-classifications'
import { formatOutlineForPrompt, type StoryOutline } from '../../../services/story-architect.service'
import type { ScriptGenerationRequest } from '../../../types/ai-providers'

export default defineEventHandler(async (event) => {
  const outputId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!outputId) throw createError({ statusCode: 400, message: 'Output ID required' })
  if (!body.feedback) throw createError({ statusCode: 400, message: 'Feedback instruction required' })

  console.log(`[API] Regenerating script for Output ${outputId} with feedback: "${body.feedback}"`)

  // 1. Buscar Output com todas as dependências do Dossier para reconstruir contexto
  const output = await prisma.output.findUnique({
    where: { id: outputId },
    include: {
      dossier: {
        include: {
          sources: true,
          notes: true,
          images: true
        }
      },
      seed: true
    }
  })

  if (!output || !output.dossier) {
    throw createError({ statusCode: 404, message: 'Output or Dossier not found' })
  }

  const dossier = output.dossier
  const scriptProvider = await providerManager.getScriptProvider()

  // Resolver estilos a partir das constantes
  const scriptStyle = output.scriptStyleId ? getScriptStyleById(output.scriptStyleId) : undefined
  const visualStyle = output.visualStyleId ? getVisualStyleById(output.visualStyleId) : undefined

  // 2. Reconstruir Prompt Context (Idêntico ao Pipeline)
  const promptContext: ScriptGenerationRequest = {
    theme: dossier.theme,
    language: output.language || 'pt-BR',
    narrationLanguage: output.narrationLanguage || 'pt-BR',

    sources: dossier.sources?.map((s: any) => ({
      title: s.title,
      content: s.content,
      type: s.sourceType,
      weight: s.weight ?? 1.0
    })) || [],

    // Mantém notas originais
    userNotes: dossier.notes?.map((n: any) => n.content) || [],

    visualReferences: dossier.images?.map((i: any) => i.description) || [],

    images: dossier.images?.map((i: any) => ({
      data: i.imageData,
      mimeType: i.mimeType || 'image/jpeg',
      title: i.description
    })).filter((img: any) => img.data) || [],

    researchData: dossier.researchData ? JSON.parse(JSON.stringify(dossier.researchData)) : undefined,

    // Classificação temática (no output) + orientação musical e visual
    dossierCategory: output.classificationId || undefined,
    musicGuidance: output.classificationId ? getClassificationById(output.classificationId)?.musicGuidance : undefined,
    musicMood: output.classificationId ? getClassificationById(output.classificationId)?.musicMood : undefined,
    visualGuidance: output.classificationId ? getClassificationById(output.classificationId)?.visualGuidance : undefined,

    targetDuration: output.duration || 300,
    targetWPM: output.targetWPM || 150,

    outputType: output.outputType as any,
    format: output.format as any,

    scriptStyleDescription: scriptStyle?.description,
    scriptStyleInstructions: scriptStyle?.instructions,

    visualStyleName: visualStyle?.name,
    visualStyleDescription: visualStyle?.description,

    // Passar tags visuais para contexto
    visualBaseStyle: visualStyle?.baseStyle || undefined,
    visualLightingTags: visualStyle?.lightingTags || undefined,
    visualAtmosphereTags: visualStyle?.atmosphereTags || undefined,
    visualCompositionTags: visualStyle?.compositionTags || undefined,
    visualGeneralTags: visualStyle?.tags || undefined,

    mustInclude: output.mustInclude ?? undefined,
    mustExclude: output.mustExclude ?? undefined,

    // 3. INJETAR O PLANO NARRATIVO (Story Architect) se disponível
    storyOutline: output.storyOutline
      ? formatOutlineForPrompt(output.storyOutline as unknown as StoryOutline)
      : undefined,

    // 3.1 Extrair metadados de monetização do outline
    narrativeRole: (output.storyOutline as any)?._monetizationMeta?.narrativeRole || undefined,
    strategicNotes: (output.storyOutline as any)?._monetizationMeta?.strategicNotes || undefined,

    // 4. INJETAR O ALINHAMENTO/FEEDBACK DO USUÁRIO
    // Adicionamos como um contexto adicional prioritário ou nota
    additionalContext: `⚠️ SOLICITAÇÃO DE REVISÃO DO USUÁRIO (ALTA PRIORIDADE):\nO usuário solicitou alterações específicas no roteiro anterior. Ignore as versões anteriores e gere um novo roteiro seguindo estritamente estas instruções:\n"${body.feedback}"`
  }

  // 4.1 Sobrescrever estilo de roteiro e editorial do monetizador (se disponível no outline)
  const monetizationMeta = (output.storyOutline as any)?._monetizationMeta
  if (monetizationMeta) {
    if (monetizationMeta.scriptStyleId) {
      const monetizationStyle = getScriptStyleById(monetizationMeta.scriptStyleId)
      if (monetizationStyle) {
        promptContext.scriptStyleDescription = monetizationStyle.description
        promptContext.scriptStyleInstructions = monetizationStyle.instructions
        console.log(`[RegenerateScript] 🎭 Estilo sobrescrito pelo monetizador: ${monetizationMeta.scriptStyleId}`)
      }
    }
    if (monetizationMeta.editorialObjectiveId && monetizationMeta.editorialObjectiveName) {
      // Combinar editorial do monetizador com feedback do usuário
      promptContext.additionalContext = `🎯 OBJETIVO EDITORIAL (CRÍTICO - GOVERNA TODA A NARRATIVA):\n${monetizationMeta.editorialObjectiveName}\n\n${promptContext.additionalContext}`
      console.log(`[RegenerateScript] 🎯 Editorial sobrescrito pelo monetizador: ${monetizationMeta.editorialObjectiveId}`)
    }
  }

  try {
    // 4. Gerar Novo Roteiro
    const scriptResponse = await scriptProvider.generate(promptContext)

    // 4.1 Registrar custo da regeneração (fire-and-forget) -- usa tokens reais quando disponíveis
    const inputTokens = scriptResponse.usage?.inputTokens ?? 0
    const outputTokens = scriptResponse.usage?.outputTokens ?? 0
    const cost = calculateLLMCost(scriptResponse.model || 'claude-opus-4-6', inputTokens, outputTokens)

    costLogService.log({
      outputId,
      resource: 'script',
      action: 'recreate',
      provider: scriptResponse.provider || 'ANTHROPIC',
      model: scriptResponse.model || 'claude-opus-4-6',
      cost,
      metadata: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
      detail: `Script regeneration - ${scriptResponse.wordCount} words, user feedback`
    }).catch(() => { })

    // 5. Atualizar no Banco (Transação)
    await prisma.$transaction(async (tx: any) => {
      // 5.1 Atualizar ou Criar Script
      const existingScript = await tx.script.findUnique({ where: { outputId } })

      let scriptId = ''

      if (existingScript) {
        await tx.script.update({
          where: { id: existingScript.id },
          data: {
            summary: scriptResponse.summary || '',
            fullText: scriptResponse.fullText,
            wordCount: scriptResponse.wordCount,
            provider: scriptProvider.getName() as any,
            modelUsed: scriptResponse.model,
            promptUsed: JSON.stringify(promptContext),
            backgroundMusicPrompt: scriptResponse.backgroundMusic?.prompt || null,
            backgroundMusicVolume: scriptResponse.backgroundMusic?.volume || null,
            updatedAt: new Date()
          }
        })
        scriptId = existingScript.id

        // Limpar tracks antigos
        await tx.backgroundMusicTrack.deleteMany({
          where: { scriptId: existingScript.id }
        })
      } else {
        const newScript = await tx.script.create({
          data: {
            outputId,
            summary: scriptResponse.summary || '',
            fullText: scriptResponse.fullText,
            wordCount: scriptResponse.wordCount,
            provider: scriptProvider.getName() as any,
            modelUsed: scriptResponse.model,
            promptUsed: JSON.stringify(promptContext),
            backgroundMusicPrompt: scriptResponse.backgroundMusic?.prompt || null,
            backgroundMusicVolume: scriptResponse.backgroundMusic?.volume || null
          }
        })
        scriptId = newScript.id
      }

      // 5.2 Limpar Cenas Antigas
      await tx.scene.deleteMany({
        where: { outputId }
      })

      // 5.3 Criar Novas Cenas
      if (scriptResponse.scenes) {
        await tx.scene.createMany({
          data: scriptResponse.scenes.map((scene: any, index: number) => ({
            outputId,
            order: index,
            narration: scene.narration,
            visualDescription: scene.visualDescription,
            sceneEnvironment: scene.sceneEnvironment || null,
            motionDescription: scene.motionDescription || null,
            audioDescription: scene.audioDescription || null,
            estimatedDuration: scene.estimatedDuration || 5
          }))
        })
      }

      // 5.4 Criar Background Music Tracks (YouTube Cinematic)
      if (scriptResponse.backgroundMusicTracks && scriptResponse.backgroundMusicTracks.length > 0) {
        await tx.backgroundMusicTrack.createMany({
          data: scriptResponse.backgroundMusicTracks.map((track: any) => ({
            scriptId,
            prompt: track.prompt,
            volume: track.volume,
            startScene: track.startScene,
            endScene: track.endScene
          }))
        })
      }

      // 5.4 Atualizar Status do Output para exigir nova aprovação
      await tx.output.update({
        where: { id: outputId },
        data: {
          scriptApproved: false,
          imagesApproved: false, // Invalida imagens pois cenas mudaram
          status: 'GENERATING' // Mantém/Volta status
        }
      })
    })

    return { success: true, message: 'Script regenerated successfully' }

  } catch (error: any) {
    console.error('[API] Script regeneration failed:', error)
    throw createError({ statusCode: 500, message: error.message || 'Failed to regenerate script' })
  }
})
