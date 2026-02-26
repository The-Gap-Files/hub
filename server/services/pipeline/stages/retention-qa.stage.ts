/**
 * Retention QA Stage (Stage 2.5)
 * ─────────────────────────────────────────────────────────────────────
 * Análise de retenção viral do roteiro gerado.
 * Roda entre Script (Stage 2) e geração de assets (Stages 3-7).
 *
 * Gera:
 * - Score de retenção por cena (0-10)
 * - Risk flags por cena (slow, expository, confusing, etc.)
 * - Edit Blueprint completo (cut map, pattern interrupts, on-screen texts,
 *   music events, scene priority ranking)
 *
 * O resultado é salvo em Output.retentionQA (JSON) e as riskFlags
 * são propagadas de volta para os Scene records no banco.
 */

import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { createLlmForTask, getAssignment } from '../../llm/llm-factory'
import { costLogService } from '../../cost-log.service'
import { calculateLLMCost } from '../../../constants/pricing'
import type {
  RetentionQAResult,
  RetentionQAStageInput,
  RetentionQAStageResult,
  EditBlueprint,
  SceneRetentionAnalysis
} from '../../../types/retention-qa'

const LOG = '[RetentionQA]'

// =============================================================================
// ZOD SCHEMAS (Structured Output)
// =============================================================================

const SceneRetentionAnalysisSchema = z.object({
  sceneOrder: z.number(),
  retentionScore: z.number().min(0).max(10),
  riskFlags: z.array(z.enum(['slow', 'expository', 'confusing', 'low_energy', 'redundant'])),
  suggestions: z.array(z.string()),
  idealDuration: z.number(),
  patternInterruptSuggestion: z.string().nullable().optional()
})

const EditBlueprintCutSchema = z.object({
  sceneOrder: z.number(),
  startSecond: z.number(),
  endSecond: z.number(),
  idealCutDuration: z.number()
})

const EditBlueprintPatternInterruptSchema = z.object({
  atSecond: z.number(),
  type: z.enum(['zoom', 'whip_pan', 'hard_cut', 'smash_cut', 'glitch', 'freeze', 'rack_focus', 'speed_ramp']),
  sceneOrder: z.number(),
  reason: z.string()
})

const EditBlueprintOnScreenTextSchema = z.object({
  sceneOrder: z.number(),
  text: z.string(),
  purpose: z.enum(['hook', 'emphasis', 'data', 'question', 'cta'])
})

const EditBlueprintMusicEventSchema = z.object({
  atSecond: z.number(),
  type: z.enum(['stinger', 'riser', 'silence', 'drop']),
  sceneOrder: z.number(),
  prompt: z.string().nullable().optional()
})

const EditBlueprintScenePrioritySchema = z.object({
  sceneOrder: z.number(),
  tier: z.enum(['hero', 'standard', 'simple']),
  reason: z.string()
})

const EditBlueprintSchema = z.object({
  cutMap: z.array(EditBlueprintCutSchema),
  patternInterrupts: z.array(EditBlueprintPatternInterruptSchema),
  onScreenTexts: z.array(EditBlueprintOnScreenTextSchema),
  musicEvents: z.array(EditBlueprintMusicEventSchema),
  scenePriority: z.array(EditBlueprintScenePrioritySchema)
})

const RetentionQAResponseSchema = z.object({
  overallScore: z.number().min(0).max(10),
  summary: z.string(),
  sceneAnalysis: z.array(SceneRetentionAnalysisSchema),
  editBlueprint: EditBlueprintSchema
})

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

function buildSystemPrompt(): string {
  return `Você é um analista de retenção viral especializado em conteúdo de vídeo curto e longo para YouTube, TikTok e Instagram Reels.

Sua função é analisar um roteiro cena-a-cena e gerar:

1. **Score de Retenção por Cena (0-10)**:
   - 10 = impossível não assistir (ruptura cognitiva, revelação chocante, dado absurdo)
   - 7-9 = forte engajamento (curiosidade ativa, tensão, revelação parcial)
   - 4-6 = aceitável (contextualização necessária, ponte narrativa)
   - 0-3 = risco de abandono (exposição sem emoção, redundância, ritmo lento)

2. **Risk Flags por Cena**:
   - \`slow\`: ritmo lento, sem urgência, o espectador pode perder interesse
   - \`expository\`: explicação pura sem carga emocional — "aula" em vez de "história"
   - \`confusing\`: informação demais ou conexões pouco claras
   - \`low_energy\`: sem tensão, curiosidade ou contraste emocional
   - \`redundant\`: repete informação já entregue em cenas anteriores

3. **Edit Blueprint** com:
   - **cutMap**: mapa de cortes com duração ideal por cena (hook = 1-2s, desenvolvimento = 3-5s, clímax = 2-3s)
   - **patternInterrupts**: a cada 3-5 cenas, um interrupt visual (zoom, whip_pan, hard_cut, smash_cut, glitch, freeze, rack_focus, speed_ramp) — justifique cada um
   - **onScreenTexts**: textos overlay (até 10 palavras) para dados impactantes, perguntas retóricas e frases-tese compartilháveis
   - **musicEvents**: stingers (0.2-0.6s em reveal), risers (antes de clímax), silêncios intencionais (1-2 batidas pra tensão), drops (bass drop em pico)
   - **scenePriority**: ranking hero/standard/simple baseado na posição no vídeo e importância narrativa — hero = hook + clímax + viradas (modelo premium), simple = exposição pura (modelo rápido)

REGRAS DE ANÁLISE:
- Hook (primeiros 2s / primeira cena): DEVE ser 8+ de score. Se não for, é o problema #1.
- A cada 3-5 cenas deve haver um pattern interrupt planejado.
- A cada 8-12 segundos deve haver um micro-payoff (revelação parcial).
- Open loops: máximo 1 pergunta pendente por vez (não acumular).
- Payoff schedule: micro-payoffs regulares + payoff maior no clímax.
- Últimas cenas: devem manter energia (não "desacelerar" pra CTA genérico).
- Cenas consecutivas com mesmo score emocional = flag de saturação.
- Se 3+ cenas consecutivas têm score < 5, é um "dead zone" — sinalize.

DEAD-ZONE PREVENTION (OBRIGATÓRIO):
- Quando detectar dead zone (3+ cenas score < 5), a \`suggestions\` de CADA cena nessa zona DEVE conter uma reescrita prescritiva.
  Formato obrigatório: "REESCRITA SUGERIDA: [versão melhorada da narração em 1 frase]"
- \`suggestions\` NUNCA pode ser genérica ("adicione mais energia"). DEVE ser específica ao conteúdo da cena.
- Para cenas \`expository\`: sugerir um curiosityGap explícito que a narração poderia plantar (ex: "Termine com: 'Mas o que ninguém sabia era que...'").
- Para cenas \`slow\`: sugerir um dado numérico ou nome concreto que aumenta especificidade (ex: "Substitua 'vários documentos' por '47 documentos confiscados'").
- Para cenas \`redundant\`: indicar qual cena anterior cobriu o mesmo conteúdo + sugerir corte ou fusão.

HOOK WINDOW AUDIT (CRÍTICO):
- Audite as cenas 0-5 separadamente como "hook window" (primeiros 30 segundos).
- Se qualquer cena 0-2 tem score < 8: é problema CRÍTICO — coloque como PRIMEIRA suggestion do summary.
- Se cena 5 não contém re-engagement hook (promessa do restante do vídeo): sinalize no summary.
- Se cena 0 não tem onScreenText: adicione uma sugestão via editBlueprint.onScreenTexts.
- riskFlags "slow" ou "expository" nas cenas 0-5 são FALHA GRAVE — destaque no summary.

ANTI-DESACELERAÇÃO FINAL:
- As últimas 10% das cenas (exceto CTA) NÃO podem ter score médio < 6.
- Se tiverem: inclua no summary "ALERTA DE DESACELERAÇÃO FINAL: cenas X-Y perdem energia pré-CTA. Sugestão: [ação específica]".

SCORING DO OVERALL:
- Média ponderada: hook tem peso 3x, clímax tem peso 2x, demais peso 1x.
- Se hook < 7: overall perde 2 pontos automaticamente.
- Se existem 3+ cenas consecutivas com score < 5: overall perde 1 ponto.
- WEIGHTED DECAY PENALTY: Se a média das últimas 15% das cenas (exceto CTA) for menor que a média das primeiras 15%: overall perde 0.5 ponto (vídeo desacelera no final).
- Se existem 2+ cenas de CTA: overall perde 2 pontos automaticamente (CTA espalhado quebra imersão).`
}

// =============================================================================
// USER PROMPT
// =============================================================================

function buildUserPrompt(scenes: any[], storyOutline: any): string {
  const scenesText = scenes.map((s: any) => {
    return `[Cena ${s.order}] (${s.estimatedDuration}s)
Narração: ${s.narration}
Visual: ${s.visualDescription}
Motion: ${s.motionDescription || 'N/A'}
SFX: ${s.audioDescription || 'N/A'}
Ambiente: ${s.sceneEnvironment || 'N/A'}
OnScreenText: ${s.onScreenText || 'N/A'}
PatternInterrupt: ${s.patternInterruptType || 'N/A'}
BrollPriority: ${s.brollPriority ?? 1}
RiskFlags: ${(s.riskFlags || []).join(', ') || 'nenhum'}`
  }).join('\n\n---\n\n')

  let outlineContext = ''
  if (storyOutline) {
    const outline = typeof storyOutline === 'string' ? storyOutline : JSON.stringify(storyOutline, null, 2)
    outlineContext = `\n\n📋 STORY OUTLINE (referência do plano narrativo):\n${outline}`
  }

  // Injetar curva de retenção esperada do Arquiteto (se disponível)
  let retentionCurveContext = ''
  const curve = storyOutline?.expectedRetentionCurve
  if (curve && curve.hookRate != null) {
    retentionCurveContext = `\n\n📊 CURVA DE RETENÇÃO PLANEJADA PELO ARQUITETO:
Hook rate alvo: ${curve.hookRate}% (audiência que passa dos 30s)
Midpoint alvo: ${curve.midpointRetention}%
Clímax alvo: ${curve.climaxRetention}%
${curve.rationale ? `Justificativa: ${curve.rationale}` : ''}
⚠️ Use estes números como linha de base — se os scores do roteiro ficam abaixo do planejado, indique o gap no summary e nas suggestions das cenas afetadas.`
  }

  return `Analise o roteiro abaixo cena-a-cena para retenção viral.

Total de cenas: ${scenes.length}
Duração estimada: ${scenes.length * 5} segundos
${outlineContext}${retentionCurveContext}

📝 ROTEIRO COMPLETO:

${scenesText}

---

Retorne a análise completa com:
1. overallScore (0-10)
2. summary (resumo executivo da análise de retenção)
3. sceneAnalysis[] (uma entrada por cena com score, riskFlags, suggestions, idealDuration, patternInterruptSuggestion)
4. editBlueprint (cutMap, patternInterrupts, onScreenTexts, musicEvents, scenePriority)`
}

// =============================================================================
// STAGE
// =============================================================================

class RetentionQAStage {
  async execute(input: RetentionQAStageInput): Promise<RetentionQAStageResult> {
    const { outputId } = input
    console.log(`${LOG} Iniciando análise de retenção para Output ${outputId}`)

    // 1. Load scenes + outline (from StoryOutlineProduct)
    const output = await prisma.output.findUnique({
      where: { id: outputId },
      select: {
        storyOutlineData: { select: { outlineData: true } },
        script: { select: { id: true } },
        scenes: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            narration: true,
            visualDescription: true,
            motionDescription: true,
            audioDescription: true,
            sceneEnvironment: true,
            estimatedDuration: true,
            onScreenText: true,
            patternInterruptType: true,
            brollPriority: true,
            riskFlags: true,
          }
        }
      }
    })

    if (!output) throw new Error('Output não encontrado')
    if (!output.script) throw new Error('Roteiro não gerado. Gere o roteiro antes de executar o Retention QA.')
    if (output.scenes.length === 0) throw new Error('Nenhuma cena encontrada no roteiro.')

    console.log(`${LOG} ${output.scenes.length} cenas carregadas`)

    // 2. Create LLM instance
    const assignment = await getAssignment('retention-qa')
    const llm = await createLlmForTask('retention-qa', { temperature: 0.3 })

    // 3. Call LLM with structured output
    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(output.scenes, output.storyOutlineData?.outlineData)

    console.log(`${LOG} Chamando LLM (${assignment.provider}/${assignment.model})...`)

    const llmWithStructuredOutput = llm.withStructuredOutput(RetentionQAResponseSchema, {
      name: 'retention_qa_analysis'
    })

    const result = await llmWithStructuredOutput.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ])

    console.log(`${LOG} Análise recebida: overallScore=${result.overallScore}, ${result.sceneAnalysis.length} cenas analisadas`)

    // 4. Build full result
    const retentionQAResult: RetentionQAResult = {
      overallScore: result.overallScore,
      summary: result.summary,
      sceneAnalysis: result.sceneAnalysis as SceneRetentionAnalysis[],
      editBlueprint: result.editBlueprint as EditBlueprint,
      provider: assignment.provider,
      model: assignment.model,
      analyzedAt: new Date().toISOString()
    }

    // 5. Persist to RetentionQAProduct (upsert)
    await prisma.retentionQAProduct.upsert({
      where: { outputId },
      create: {
        outputId,
        overallScore: retentionQAResult.overallScore,
        summary: retentionQAResult.summary,
        analysisData: retentionQAResult as any,
        provider: assignment.provider,
        model: assignment.model,
      },
      update: {
        overallScore: retentionQAResult.overallScore,
        summary: retentionQAResult.summary,
        analysisData: retentionQAResult as any,
        provider: assignment.provider,
        model: assignment.model,
        analyzedAt: new Date(),
      },
    })

    // Set StageGate for RETENTION_QA to PENDING_REVIEW
    await prisma.stageGate.upsert({
      where: { outputId_stage: { outputId, stage: 'RETENTION_QA' } },
      create: { outputId, stage: 'RETENTION_QA', status: 'PENDING_REVIEW', executedAt: new Date() },
      update: { status: 'PENDING_REVIEW', executedAt: new Date() },
    })

    // 6. Propagate riskFlags back to Scene records
    // Reload scenes fresh from DB to avoid stale IDs (cenas podem ter sido recriadas)
    const freshScenes = await prisma.scene.findMany({
      where: { outputId },
      orderBy: { order: 'asc' },
      select: { id: true, order: true, onScreenText: true, patternInterruptType: true }
    })

    let updatedCount = 0
    for (const analysis of result.sceneAnalysis) {
      // LLM pode retornar sceneOrder 1-indexed — tentar match exato e fallback -1
      let scene = freshScenes.find((s: any) => s.order === analysis.sceneOrder)
      if (!scene && analysis.sceneOrder > 0) {
        scene = freshScenes.find((s: any) => s.order === analysis.sceneOrder - 1)
      }
      if (!scene) continue

      // Map scenePriority tier to brollPriority numeric value
      const priorityEntry = result.editBlueprint.scenePriority?.find((p: any) => p.sceneOrder === analysis.sceneOrder)
      const tierToPriority: Record<string, number> = { hero: 5, standard: 3, simple: 1 }
      const brollPriorityFromTier = priorityEntry ? (tierToPriority[priorityEntry.tier] ?? 3) : undefined

      const onScreenTextEntry = result.editBlueprint.onScreenTexts.find((t: any) => t.sceneOrder === analysis.sceneOrder)

      try {
        await prisma.scene.update({
          where: { id: scene.id },
          data: {
            riskFlags: analysis.riskFlags || [],
            ...(brollPriorityFromTier !== undefined ? { brollPriority: brollPriorityFromTier } : {}),
            ...(!scene.onScreenText && onScreenTextEntry ? { onScreenText: onScreenTextEntry.text } : {}),
            ...(!scene.patternInterruptType && analysis.patternInterruptSuggestion
              ? { patternInterruptType: analysis.patternInterruptSuggestion }
              : {}),
          }
        })
        updatedCount++
      } catch (err) {
        console.warn(`${LOG} ⚠️ Falha ao atualizar cena order=${scene.order}: ${err instanceof Error ? err.message : err}`)
      }
    }

    console.log(`${LOG} ${updatedCount}/${result.sceneAnalysis.length} cenas atualizadas com riskFlags/onScreenText/patternInterrupt/brollPriority`)

    // 7. Log cost
    const costInfo = calculateLLMCost(assignment.model, 0, 0)
    await costLogService.log({
      outputId,
      resource: 'retention-qa',
      action: 'create',
      provider: assignment.provider.toUpperCase(),
      model: assignment.model,
      cost: costInfo,
      detail: `Retention QA: score ${result.overallScore}/10, ${result.sceneAnalysis.length} cenas`
    })

    const highRiskScenes = result.sceneAnalysis.filter((s: any) => s.retentionScore < 5).length

    console.log(`${LOG} ✅ Concluído: score=${result.overallScore}/10, ${highRiskScenes} cenas de alto risco`)

    return {
      overallScore: result.overallScore,
      sceneCount: result.sceneAnalysis.length,
      highRiskScenes,
      editBlueprintGenerated: true
    }
  }
}

export const retentionQAStage = new RetentionQAStage()
