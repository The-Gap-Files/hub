import { prisma } from '../../../utils/prisma'
import { providerManager } from '../../../services/providers'
import { costLogService } from '../../../services/cost-log.service'
import { calculateLLMCost } from '../../../constants/pricing'
import { getVisualStyleById } from '../../../constants/cinematography/visual-styles'
import { getScriptStyleById } from '../../../constants/storytelling/script-styles'
import { getClassificationById } from '../../../constants/content/intelligence-classifications'
import { formatOutlineForPrompt, type StoryOutline } from '../../../services/story-architect.service'
import { validateScript } from '../../../services/script-validator.service'
import { filmmakerDirector, type ProductionContext } from '../../../services/filmmaker-director.service'
import type { ScriptGenerationRequest } from '../../../types/ai-providers'
import { validatorsEnabled } from '../../../utils/validators'

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

    targetDuration: (output.monetizationContext as any)?.sceneCount
      ? (output.monetizationContext as any).sceneCount * 5
      : (output.duration || 300),
    targetSceneCount: (output.monetizationContext as any)?.sceneCount,
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
    shortFormatType: (output.storyOutline as any)?._monetizationMeta?.shortFormatType || undefined,
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
    if (monetizationMeta.avoidPatterns && monetizationMeta.avoidPatterns.length > 0) {
      promptContext.avoidPatterns = monetizationMeta.avoidPatterns
      console.log(`[RegenerateScript] ⛔ ${monetizationMeta.avoidPatterns.length} anti-padrões injetados`)
    }
  }

  // Teasers: depender do outline aprovado (sem dossiê/brief global)
  if (monetizationMeta?.itemType === 'teaser') {
    promptContext.sources = []
    promptContext.additionalSources = []
    promptContext.userNotes = []
    promptContext.visualReferences = []
    promptContext.researchData = undefined
    ;(promptContext as any).persons = []
    ;(promptContext as any).neuralInsights = []
  }

  // ── Resolver Script Provider (ROTEAMENTO SOLID) ────────
  const isHookOnly = promptContext.narrativeRole === 'hook-only'
  const scriptProvider = isHookOnly
    ? await providerManager.getHookOnlyScriptProvider()
    : await providerManager.getScriptProvider()

  if (isHookOnly) {
    console.log(`[RegenerateScript] 💥 HOOK-ONLY: usando provider dedicado (${scriptProvider.getName()}).`)
  }

  try {
    // 4. Gerar Novo Roteiro com loop de validação (máx 3 retries)
    const MAX_RETRIES = 10
    let scriptResponse = await scriptProvider.generate(promptContext)

    // 4.1 Registrar custo da primeira geração
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

    // 4.2 Validar e retry se reprovado
    const regenMeta = (output.storyOutline as any)?._monetizationMeta
    let scriptValidation: { approved: boolean; violations?: string[]; corrections?: string; overResolution?: boolean } | undefined
    if (!validatorsEnabled()) {
      console.log('[RegenerateScript] ⏭️ Validação DESABILITADA temporariamente (bypass global).')
    }
    if (validatorsEnabled() && promptContext.narrativeRole && regenMeta?.itemType === 'teaser') {
      const outlineData = output.storyOutline as any
      // Histórico acumulativo de feedbacks — garante que erros corrigidos não voltem
      const validationHistory: string[] = []

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          scriptValidation = await validateScript(
            scriptResponse.scenes || [],
            {
              itemType: 'teaser',
              narrativeRole: promptContext.narrativeRole,
              angleCategory: regenMeta?.angleCategory,
              shortFormatType: promptContext.shortFormatType,
              targetDuration: output.duration || undefined,
              avoidPatterns: regenMeta?.avoidPatterns,
              selectedHookLevel: outlineData?._selectedHookLevel || undefined,
              plannedOpenLoops: outlineData?.openLoops?.filter((l: any) => l.closedAtBeat === null)
            }
          )

          if (scriptValidation.approved) {
            console.log(`[RegenerateScript] ✅ Script APROVADO${attempt > 0 ? ` (após ${attempt} retry)` : ''}.`)
            break
          }

          console.warn(`[RegenerateScript] ⚠️ Script REPROVADO (tentativa ${attempt + 1}/${MAX_RETRIES + 1}): ${scriptValidation.violations?.join('; ')}`)

          if (attempt < MAX_RETRIES) {
            // Montar feedback desta tentativa
            const currentFeedback = [
              `⚠️ CORREÇÃO OBRIGATÓRIA (VALIDADOR REPROVOU O ROTEIRO — TENTATIVA ${attempt + 1}):`,
              ...(scriptValidation.violations || []).map(v => `- VIOLAÇÃO: ${v}`),
              scriptValidation.corrections ? `\nINSTRUÇÕES DE CORREÇÃO: ${scriptValidation.corrections}` : '',
              scriptValidation.overResolution ? `\n🚨 O roteiro RESOLVE DEMAIS para a role "${promptContext.narrativeRole}". Reduza explicações, remova conclusões e deixe loops abertos.` : ''
            ].filter(Boolean).join('\n')

            // Acumular no histórico
            validationHistory.push(currentFeedback)

            const fullValidationFeedback = validationHistory.length > 1
              ? `📋 HISTÓRICO DE CORREÇÕES (${validationHistory.length} tentativas reprovadas):\n${'─'.repeat(50)}\n${validationHistory.map((f, i) => `[Tentativa ${i + 1}]\n${f}`).join('\n\n')}\n${'─'.repeat(50)}\n\n🚨 NÃO repita NENHUM erro listado acima. Cada violação já corrigida que reaparecer é uma falha crítica.`
              : currentFeedback

            const retryContext = {
              ...promptContext,
              additionalContext: [promptContext.additionalContext || '', fullValidationFeedback].filter(Boolean).join('\n\n')
            }

            console.log(`[RegenerateScript] 🔄 Regenerando com feedback do validador (retry ${attempt + 1}, histórico: ${validationHistory.length})...`)
            scriptResponse = await scriptProvider.generate(retryContext)

            costLogService.log({
              outputId,
              resource: 'script',
              action: 'recreate',
              provider: scriptResponse.provider || 'ANTHROPIC',
              model: scriptResponse.model || 'unknown',
              cost: calculateLLMCost(scriptResponse.model || 'claude-opus-4-6', scriptResponse.usage?.inputTokens ?? 0, scriptResponse.usage?.outputTokens ?? 0),
              metadata: { input_tokens: scriptResponse.usage?.inputTokens ?? 0, output_tokens: scriptResponse.usage?.outputTokens ?? 0 },
              detail: `Script retry ${attempt + 1} (validator feedback)`
            }).catch(() => { })
          }
        } catch (e: any) {
          console.warn(`[RegenerateScript] ⚠️ Erro na validação (não-bloqueante): ${e?.message || e}`)
          break
        }
      }
    }

    // ─── AGENTE CINEASTA (FILMMAKER DIRECTOR) — PÓS-PROCESSAMENTO ───
    // Polir descrições visuais do roteiro antes de salvar.
    // Mesmo fluxo do output-pipeline.service.ts: batching de 50 cenas.
    if (scriptResponse.scenes && scriptResponse.scenes.length > 0) {
      try {
        console.log(`[RegenerateScript] 🎬 Acionando o Agente Cineasta para ${scriptResponse.scenes.length} cenas...`)

        const baseStyleForDirector = visualStyle?.baseStyle ||
          promptContext.visualBaseStyle ||
          'Cinematic 35mm photography, hyperrealistic dark mystery style'

        // Montar Production Context a partir do visual style (constantes)
        const anchorParts: string[] = []
        if (visualStyle) {
          if (visualStyle.baseStyle) anchorParts.push(visualStyle.baseStyle)
          if (visualStyle.lightingTags) anchorParts.push(visualStyle.lightingTags)
          if (visualStyle.atmosphereTags) anchorParts.push(visualStyle.atmosphereTags)
          if (visualStyle.compositionTags) anchorParts.push(visualStyle.compositionTags)
          if (visualStyle.colorPalette) anchorParts.push(visualStyle.colorPalette)
          if (visualStyle.qualityTags) anchorParts.push(visualStyle.qualityTags)
          if (visualStyle.tags) anchorParts.push(visualStyle.tags)
        }

        const productionCtx: ProductionContext = {
          styleAnchorTags: anchorParts.length > 0 ? anchorParts.join(', ') : undefined,
          visualIdentity: dossier.visualIdentityContext || undefined,
          storyOutline: output.storyOutline as any || undefined,
        }

        // Batching: dividir cenas em lotes para evitar truncamento
        const FILMMAKER_BATCH_SIZE = 50
        const allInputScenes = scriptResponse.scenes.map((s: any) => ({
          order: 0,
          narration: s.narration,
          currentVisual: s.visualDescription,
          currentEnvironment: s.sceneEnvironment,
          estimatedDuration: s.estimatedDuration || 5
        }))

        type FilmmakerResult = Awaited<ReturnType<typeof filmmakerDirector.refineScript>>
        let allRefinedScenes: FilmmakerResult = []

        if (allInputScenes.length <= FILMMAKER_BATCH_SIZE) {
          allRefinedScenes = await filmmakerDirector.refineScript(allInputScenes, baseStyleForDirector, undefined, productionCtx)
        } else {
          console.log(`[RegenerateScript] 🎬 Cineasta: ${allInputScenes.length} cenas → ${Math.ceil(allInputScenes.length / FILMMAKER_BATCH_SIZE)} lotes de até ${FILMMAKER_BATCH_SIZE}.`)
          for (let batchStart = 0; batchStart < allInputScenes.length; batchStart += FILMMAKER_BATCH_SIZE) {
            const batch = allInputScenes.slice(batchStart, batchStart + FILMMAKER_BATCH_SIZE)
            console.log(`[RegenerateScript] 🎬 Cineasta: lote ${Math.floor(batchStart / FILMMAKER_BATCH_SIZE) + 1} (${batch.length} cenas)...`)
            const batchResult = await filmmakerDirector.refineScript(batch, baseStyleForDirector, undefined, productionCtx)
            if (batchResult) {
              allRefinedScenes = [...(allRefinedScenes || []), ...batchResult]
            }
          }
        }

        // Mesclar refinamentos de volta nas cenas originais
        if (allRefinedScenes && allRefinedScenes.length === scriptResponse.scenes.length) {
          scriptResponse.scenes = scriptResponse.scenes.map((original: any, i: number) => {
            const refined = allRefinedScenes?.[i]
            if (!refined) return original
            return {
              ...original,
              visualDescription: refined.visualDescription || original.visualDescription,
              motionDescription: refined.motionDescription || original.motionDescription,
              sceneEnvironment: refined.sceneEnvironment || original.sceneEnvironment,
              endVisualDescription: refined.endVisualDescription ?? original.endVisualDescription,
              endImageReferenceWeight: refined.endImageReferenceWeight ?? original.endImageReferenceWeight
            }
          })
          console.log(`[RegenerateScript] ✅ Cineasta refinou todas as ${scriptResponse.scenes.length} cenas com sucesso.`)
        } else {
          console.warn(`[RegenerateScript] ⚠️ Cineasta retornou número incorreto de cenas (${allRefinedScenes?.length} vs ${scriptResponse.scenes.length}). Ignorando refinamento.`)
        }
      } catch (directorError) {
        console.error('[RegenerateScript] ❌ Erro no Agente Cineasta (salvando roteiro bruto):', directorError)
      }
    }

    // 5. Atualizar no Banco (Transação)
    // Timeout aumentado para suportar scripts grandes (100+ cenas)
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
            narration: scene.narration?.trim(),
            visualDescription: scene.visualDescription?.trim(),
            sceneEnvironment: scene.sceneEnvironment?.trim() || null,
            motionDescription: scene.motionDescription?.trim() || null,
            audioDescription: scene.audioDescription?.trim() || null,
            audioDescriptionVolume: scene.audioDescriptionVolume ?? null,
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

      // 5.5 Atualizar Status do Output para exigir nova aprovação
      await tx.output.update({
        where: { id: outputId },
        data: {
          scriptApproved: false,
          imagesApproved: false, // Invalida imagens pois cenas mudaram
          status: 'GENERATING' // Mantém/Volta status
        }
      })
    }, { timeout: 30000 })

    return {
      success: true,
      message: 'Script regenerated successfully',
      validation: scriptValidation || undefined
    }

  } catch (error: any) {
    console.error('[API] Script regeneration failed:', error)
    throw createError({ statusCode: 500, message: error.message || 'Failed to regenerate script' })
  }
})
