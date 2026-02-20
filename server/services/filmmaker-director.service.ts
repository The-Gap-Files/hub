/**
 * Filmmaker Director Service (Agente Cineasta)
 *
 * Pós-processamento criativo: lê o roteiro gerado pelo Roteirista e
 * refina os campos visuais (visualDescription) e a coreografia de
 * movimento (motionDescription) para garantir qualidade cinematográfica
 * na geração de imagem e vídeo IA.
 *
 * Usa a LLM Factory (createLlmForTask) com task 'filmmaker-director'
 * configurável via UI (Settings → Providers).
 */

import { createLlmForTask } from './llm/llm-factory'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createPipelineLogger } from '../utils/pipeline-logger'
import type { StoryOutline } from './story-architect.service'
import fs from 'node:fs/promises'
import path from 'node:path'

interface SceneInput {
  order: number
  narration: string
  currentVisual?: string
  currentMotion?: string
  currentEnvironment?: string
  estimatedDuration: number
}

interface RefinedScene {
  order: number
  visualDescription: string
  motionDescription: string
  sceneEnvironment?: string
}

/**
 * Contexto de produção injetado pelo pipeline para que o filmmaker
 * tenha consciência do estilo global, identidade visual e continuidade.
 */
export interface ProductionContext {
  /** Tags de estilo já aplicadas como anchor no pipeline (ex: "cinematic noir, high contrast") */
  styleAnchorTags?: string
  /** Identidade visual do dossiê (ex: "1970s urban realism, period-accurate interiors") */
  visualIdentity?: string
  /** StoryOutline do Arquiteto — permite ao cineasta calibrar intensidade por segmento narrativo */
  storyOutline?: StoryOutline
}

export class FilmmakerDirectorService {

  /**
   * Carrega a Skill (persona do cineasta) do disco
   */
  private async loadSkill(): Promise<string> {
    const skillPath = path.resolve(process.cwd(), 'server/skills/filmmaker-director.md')
    try {
      return await fs.readFile(skillPath, 'utf-8')
    } catch {
      console.warn('[FilmmakerDirector] ⚠️ filmmaker-director.md não encontrado, usando fallback.')
      return 'You are an expert cinematographer specializing in Dark Mystery. Refine visual prompts for AI image and video generation.'
    }
  }

  /**
   * Monta a seção de Production Awareness para o system prompt
   */
  private buildProductionAwareness(production?: ProductionContext): string {
    if (!production) return ''

    const sections: string[] = []

    if (production.styleAnchorTags) {
      sections.push(`[STYLE ANCHOR — já aplicado pelo pipeline ao prompt final de imagem]
"${production.styleAnchorTags}"
→ NÃO repita essas tags literalmente no visualDescription. Elas já serão injetadas como prefixo.
→ Foque em parâmetros COMPLEMENTARES: lente, distância focal, profundidade de campo, origem da luz, texturas, materiais.`)
    }

    if (production.visualIdentity) {
      sections.push(`[VISUAL IDENTITY — diretrizes do universo/dossiê]
"${production.visualIdentity}"
→ Incorpore essas diretrizes organicamente nas descrições visuais (período, materialidade, paleta).
→ Não copie literalmente; traduza em parâmetros técnicos de cinematografia.`)
    }

    const narrativeBlock = production.storyOutline
      ? this.buildNarrativeAwareness(production.storyOutline)
      : ''

    if (sections.length === 0 && !narrativeBlock) return ''

    return `\n───────────────────────────────────────────
PRODUCTION AWARENESS (contexto do pipeline):
${sections.join('\n\n')}
───────────────────────────────────────────${narrativeBlock}`
  }

  /**
   * Cria um mapa por-cena de segmento narrativo, nível de tensão e nota de beat.
   * Baseia-se no segmentDistribution do StoryOutline para saber quais cenas
   * pertencem a HOOK, CONTEXT, RISING, CLIMAX, RESOLUTION e CTA.
   */
  private buildSceneNarrativeAnnotations(
    outline: StoryOutline,
    totalScenes: number
  ): Array<{ segment: string; tensionLevel: string; note: string }> {
    const dist = outline.segmentDistribution
    if (!dist) return []

    const segments = [
      { name: 'HOOK',       count: dist.hook,      defaultTension: 'high' },
      { name: 'CONTEXT',    count: dist.context,   defaultTension: 'low' },
      { name: 'RISING',     count: dist.rising,    defaultTension: 'medium' },
      { name: 'CLIMAX',     count: dist.climax,    defaultTension: 'peak' },
      { name: 'RESOLUTION', count: dist.resolution, defaultTension: 'medium' },
      { name: 'CTA',        count: dist.cta,       defaultTension: 'low' }
    ]

    const annotations: Array<{ segment: string; tensionLevel: string; note: string }> = []
    const tensionCurve = outline.tensionCurve || []
    const risingBeats = outline.risingBeats || []
    const risingCount = dist.rising

    for (const seg of segments) {
      for (let i = 0; i < seg.count; i++) {
        if (annotations.length >= totalScenes) break

        let tension = seg.defaultTension
        let note = seg.name

        if (seg.name === 'HOOK') {
          note = `HOOK — ${(outline.hookStrategy || 'Opening impact').slice(0, 80)}`
        } else if (seg.name === 'RISING' && risingCount > 0) {
          const beatIdx = tensionCurve.length > 0
            ? Math.min(Math.floor((i / risingCount) * tensionCurve.length), tensionCurve.length - 1)
            : -1
          if (beatIdx >= 0 && tensionCurve[beatIdx]) {
            tension = tensionCurve[beatIdx]
          }
          const beat = risingBeats[Math.min(beatIdx >= 0 ? beatIdx : 0, risingBeats.length - 1)]
          note = beat
            ? `RISING beat ${beat.order}: "${beat.revelation.slice(0, 70)}"`
            : `RISING — scene ${i + 1}/${risingCount}`
        } else if (seg.name === 'CLIMAX') {
          note = `CLIMAX (${outline.climaxFormula || 'peak'}) — ${(outline.climaxMoment || 'Central revelation').slice(0, 80)}`
        } else if (seg.name === 'RESOLUTION') {
          const rl = outline.resolutionLevel
          note = `RESOLUTION — ${rl === 'none' ? 'ZERO resolution, visual tension remains' : rl === 'partial' ? 'Partial resolution, open questions persist' : 'Full resolution, emotional landing'}`
        } else if (seg.name === 'CTA') {
          note = `CTA — ${(outline.ctaApproach || 'Closing').slice(0, 60)}`
        }

        annotations.push({ segment: seg.name, tensionLevel: tension, note })
      }
    }

    // Scenes beyond the planned distribution (screenwriter may add up to +4 extra)
    while (annotations.length < totalScenes) {
      annotations.push({ segment: 'EXTRA', tensionLevel: 'low', note: 'Overflow scene — treat as CTA/closing' })
    }

    return annotations
  }

  /**
   * Bloco de consciência narrativa para o system prompt.
   * Resume o arco emocional, progressão de tom, curva de tensão e o momento de clímax.
   */
  private buildNarrativeAwareness(outline: StoryOutline): string {
    const lines: string[] = [
      ``,
      `───────────────────────────────────────────`,
      `NARRATIVE AWARENESS (blueprint do Story Architect — governa a progressão cinematográfica):`,
      ``,
      `[ARCO EMOCIONAL]    : ${outline.emotionalArc || 'Não definido'}`,
      `[PROGRESSÃO DE TOM] : ${outline.toneProgression || 'Não definido'}`,
      `[FÓRMULA DO CLÍMAX] : ${outline.climaxFormula || 'Não definido'}`,
      `[MOMENTO DE CLÍMAX] : ${(outline.climaxMoment || 'Revelação central').slice(0, 100)}`,
      `[RESOLUÇÃO]         : ${outline.resolutionLevel || 'full'}`,
      ``,
      `Guia de Intensidade Visual por Segmento (calibra o Modo Visual e o Movimento):`,
      `  HOOK       → Alta intensidade. Ruptura visual imediata. Primeiro quadro já impacta.`,
      `  CONTEXT    → Baixa-média. Planos abertos, luz natural. Estabelece o universo.`,
      `  RISING     → Progressão. Siga a Tension Curve cena a cena (veja abaixo).`,
      `  CLIMAX     → PICO ABSOLUTO de todo o vídeo. Expressionist ou Noir no máximo contraste.`,
      `  RESOLUTION → Redução gradual. Aterramento emocional. Não dramatize.`,
      `  CTA        → Mínima. Limpa. Não distrai da mensagem final.`,
    ]

    if (outline.tensionCurve && outline.tensionCurve.length > 0) {
      lines.push(``)
      lines.push(`Tension Curve (seção RISING — intensidade por beat, em ordem):`)
      lines.push(outline.tensionCurve.map((level, i) => `  Beat ${i + 1}: ${level.toUpperCase()}`).join('\n'))
      lines.push(`  → PAUSE = Static locked-off ou Pull-back lento (o vazio é o statement)`)
      lines.push(`  → PEAK  = Expressionist ou Noir com máximo contraste, movimento preciso`)
    }

    const openUnclosed = (outline.openLoops || []).filter(l => l.closedAtBeat === null)
    if (openUnclosed.length > 0) {
      lines.push(``)
      lines.push(`Open Loops (threads intencionalmente não-resolvidos — manter tensão latente):`)
      openUnclosed.forEach(loop => lines.push(`  • "${loop.question}"`))
      lines.push(`  → Cenas RESOLUTION sobre esses loops: sem closure visual completo.`)
      lines.push(`  → Evite luz quente e planos abertos nessas cenas.`)
    }

    lines.push(`───────────────────────────────────────────`)
    lines.push(`INSTRUÇÃO: Cada cena abaixo tem narrativeSegment, tensionLevel e narrativeNote.`)
    lines.push(`USE esses campos para classificar o Beat Dramático (seção 1.5) antes de escrever.`)
    lines.push(`CLIMAX + tensionLevel=PEAK → seu visual e movimento mais dramáticos do vídeo.`)
    lines.push(`CONTEXT + tensionLevel=LOW → Documentary/Verite. Nunca Noir aqui.`)

    return lines.join('\n')
  }

  /**
   * Monta instruções de continuidade entre cenas com mesmo sceneEnvironment
   */
  private buildContinuityContext(scenes: SceneInput[]): string {
    const envGroups = new Map<string, number[]>()
    scenes.forEach((s, i) => {
      if (s.currentEnvironment) {
        const group = envGroups.get(s.currentEnvironment) || []
        group.push(i)
        envGroups.set(s.currentEnvironment, group)
      }
    })

    const sharedEnvs = [...envGroups.entries()].filter(([, indices]) => indices.length > 1)
    if (sharedEnvs.length === 0) return ''

    const envList = sharedEnvs.map(([env, indices]) =>
      `- "${env}": cenas ${indices.map(i => i).join(', ')}`
    ).join('\n')

    return `
CONTINUIDADE VISUAL (cenas que compartilham o mesmo ambiente):
${envList}

→ Cenas no MESMO ambiente devem manter: mesma lente, mesma temperatura de cor, mesmos materiais/texturas, mesma origem de luz.
→ Varie apenas: ângulo de câmera, enquadramento, e elementos dinâmicos do foreground.
→ Cenas em ambientes DIFERENTES devem ter transição visual limpa (nova paleta, nova lente, nova luz).`
  }

  /**
   * Valida as cenas refinadas contra regras de qualidade do filmmaker.
   * Retorna warnings (não bloqueia) para log e monitoramento.
   */
  private validateRefinedScenes(scenes: RefinedScene[]): {
    warnings: string[]
    stats: { pushInPercent: number; uniqueMotions: number; totalScenes: number }
  } {
    const warnings: string[] = []

    const forbiddenMotion = ['zoom', 'handheld', 'wobble', 'shake', 'tremor', 'truck', 'fast', 'quick', 'rapid', 'swift']

    let pushInCount = 0
    let consecutiveSameMovement = 1
    let lastMovementType = ''
    const motionSet = new Set<string>()

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]!
      const motion = (scene.motionDescription || '').toLowerCase()
      const visual = (scene.visualDescription || '').toLowerCase()

      // Palavras proibidas em motion
      for (const word of forbiddenMotion) {
        if (motion.includes(word)) {
          warnings.push(`Cena ${scene.order}: motionDescription contém termo proibido "${word}"`)
        }
      }

      // Push-in count
      if (motion.includes('push-in') || motion.includes('dolly in') || motion.includes('dolly forward')) {
        pushInCount++
      }

      // Movimento consecutivo
      const movementType = this.extractPrimaryMovement(motion)
      if (movementType === lastMovementType && movementType !== '' && movementType !== 'unknown') {
        consecutiveSameMovement++
        if (consecutiveSameMovement > 2) {
          warnings.push(`Cena ${scene.order}: mesmo movimento "${movementType}" por ${consecutiveSameMovement} cenas consecutivas (max 2)`)
        }
      } else {
        consecutiveSameMovement = 1
      }
      lastMovementType = movementType

      // Duplicata de motion (normalizada — troca números por placeholder)
      const normalizedMotion = motion.replace(/\d+(\.\d+)?/g, 'N').replace(/\s+/g, ' ').trim()
      if (normalizedMotion.length > 20) {
        motionSet.add(normalizedMotion)
      }

    }

    // Push-in percentage
    const pushInPercent = scenes.length > 0 ? (pushInCount / scenes.length) * 100 : 0
    if (pushInPercent > 40) {
      warnings.push(`Push-in usado em ${pushInPercent.toFixed(1)}% das cenas (max 40%)`)
    }

    // Unicidade de motions
    const uniqueMotions = motionSet.size
    const uniquePercent = scenes.length > 0 ? (uniqueMotions / scenes.length) * 100 : 0
    if (uniquePercent < 70) {
      warnings.push(`Apenas ${uniquePercent.toFixed(1)}% de motionDescriptions são únicas (min 70%)`)
    }

    return {
      warnings,
      stats: { pushInPercent, uniqueMotions, totalScenes: scenes.length }
    }
  }

  /**
   * Extrai o tipo primário de movimento de uma motionDescription
   */
  private extractPrimaryMovement(motion: string): string {
    const movements = [
      'static', 'push-in', 'dolly forward', 'dolly in',
      'pull-back', 'dolly backward', 'dolly out',
      'pan left', 'pan right', 'pan',
      'tilt up', 'tilt down', 'tilt',
      'lateral slide', 'rack focus', 'breathing camera',
      'deliberate freeze', 'freeze'
    ]
    for (const m of movements) {
      if (motion.includes(m)) return m
    }
    return 'unknown'
  }

  /**
   * Refina as cenas aplicando direção de fotografia e movimento
   */
  async refineScript(
    scenes: SceneInput[],
    baseStyle: string,
    context?: string,
    production?: ProductionContext
  ): Promise<RefinedScene[]> {
    const log = createPipelineLogger({ stage: 'Filmmaker', outputId: 'director' })

    // 1. Carregar a Skill (System Prompt)
    const skillContent = await this.loadSkill()

    // 2. Preparar o System Message (persona + regras + production awareness)
    const productionAwareness = this.buildProductionAwareness(production)

    const systemPrompt = `${skillContent}

───────────────────────────────────────────
ESTILO VISUAL BASE (USE SEMPRE COMO PRIMEIRO ELEMENTO):
"${baseStyle}"
───────────────────────────────────────────
${productionAwareness}
${context ? `\nCONTEXTO ADICIONAL:\n${context}` : ''}`

    // 3. Preparar o User Message (cenas + contexto de continuidade)
    const continuityContext = this.buildContinuityContext(scenes)

    // Anotações narrativas por cena (segmento, tensão, contexto do beat)
    const narrativeAnnotations = production?.storyOutline
      ? this.buildSceneNarrativeAnnotations(production.storyOutline, scenes.length)
      : null

    const userPrompt = `CENAS DO ROTEIRO PARA REFINAR:

${JSON.stringify(
      scenes.map((s, i) => {
        const ann = narrativeAnnotations?.[i]
        return {
          order: i,
          ...(ann ? {
            narrativeSegment: ann.segment,
            tensionLevel: ann.tensionLevel,
            narrativeNote: ann.note
          } : {}),
          narration: s.narration,
          environment: s.currentEnvironment || null,
          durationSeconds: s.estimatedDuration
        }
      }),
      null,
      2
    )}
${continuityContext}

TAREFA:
Para CADA cena acima, reescreva os campos visuais e de movimento aplicando suas regras de direção cinematográfica.

🎯 ORIENTAÇÃO DE DENSIDADE:
- visualDescription: priorize QUALIDADE e RIQUEZA descritiva. Um bom prompt tem entre 50-120 palavras — inclua: lente/focal length, DOF, origem FÍSICA de luz, texturas concretas, materiais, referência de filme/stock se adequado.
- Se a cena for simples, enriqueça com: ângulo exato, temperatura de cor, textura de superfície, profundidade de campo, tag de realismo.
- Cenas finais (CTA, resolução) mantêm o mesmo padrão de riqueza das cenas iniciais.

📝 VOCABULÁRIO — PREFIRA TERMOS TÉCNICOS CONCRETOS:
Palavras como "gritty", "moody", "atmospheric", "eerie", "dramatic" são permitidas quando ACOMPANHADAS de parâmetros técnicos que as traduzam.
→ ❌ "gritty Brooklyn street" (vago sozinho)
→ ✅ "gritty Brooklyn street, wet asphalt reflecting sodium vapor streetlights, cracked concrete curb in foreground, 24mm lens, deep focus" (concreto + técnico)

NÃO utilize nenhuma descrição visual ou de movimento pré-existente de outros agentes. Baseie TODAS as decisões visuais e de movimento APENAS na narração da cena, no estilo visual base informado e no contexto adicional fornecido.

IMPORTANTE SOBRE QUALIDADE VISUAL E MOVIMENTO:
- Todas as cenas têm duração máxima de 7.5 segundos e devem ser tratadas como UM ÚNICO PLANO CONTÍNUO (um shot).
- Objetos de cenário que deveriam estar parados (mesas, portas, móveis, carros estacionados, paredes, prédios, etc.) NÃO devem se mover nem "andar" sozinhos, a menos que a narração descreva claramente esse movimento.
- Use gerúndios apenas para elementos dinâmicos de ambiente (poeira, fumaça, chuva, cortinas, chamas, neblina, etc.), nunca para mudanças bruscas de posição de objetos sólidos.

Campos a gerar por cena:
- visualDescription: prompt completo para gerar a imagem da cena (em inglês, com estilo visual aplicado). Priorize RIQUEZA descritiva (50-120 palavras). Toda visualDescription DEVE incluir: lente + focal length, DOF explícito, fonte física de luz, texturas concretas, tag de realismo. NÃO repita tags do Style Anchor — elas já serão prefixadas automaticamente pelo pipeline. Prompts com poucos detalhes geram imagens genéricas — invista em densidade e especificidade.
- motionDescription: descrição técnica do movimento de câmera/sujeito para o modelo de vídeo, explicando claramente como a câmera se move e quais elementos animados existem na cena. PROIBIDO: zoom, handheld, wobble, shake, tremor, truck, fast, quick, rapid, swift.

Retorne APENAS um JSON válido (sem markdown, sem explicações):
{
  "scenes": [
    { "order": 0, "visualDescription": "...", "motionDescription": "..." }
  ]
}`

    // 4. Chamar o LLM via Factory
    log.info(`Chamando LLM para refinar ${scenes.length} cenas...`)
    const llm = await createLlmForTask('filmmaker-director', { temperature: 0.6, maxTokens: 16384 })

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ])

    const rawText = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)

    // 5. Parsear o Resultado
    try {
      // Limpar possível markdown wrapper
      const cleanJson = rawText.replace(/```json\n?|```/g, '').trim()
      const parsed = JSON.parse(cleanJson) as { scenes: RefinedScene[] }

      if (!Array.isArray(parsed.scenes)) {
        throw new Error('Formato de resposta inválido: "scenes" não é um array.')
      }

      log.info(`✅ Cineasta retornou ${parsed.scenes.length} cenas refinadas.`)

      // Validação de qualidade
      const validation = this.validateRefinedScenes(parsed.scenes)
      if (validation.warnings.length > 0) {
        log.warn(`⚠️ Validação encontrou ${validation.warnings.length} problemas:`)
        validation.warnings.forEach(w => log.warn(`  - ${w}`))
      }
      log.info(`📊 Stats: push-in ${validation.stats.pushInPercent.toFixed(1)}%, ` +
        `${validation.stats.uniqueMotions}/${validation.stats.totalScenes} motions únicos`)

      return parsed.scenes
    } catch (error) {
      console.error('[FilmmakerDirector] Falha ao parsear JSON do LLM:', error)
      console.error('[FilmmakerDirector] Resposta Raw (primeiros 500 chars):', rawText.slice(0, 500))

      // Fallback seguro: retorna as cenas originais sem alteração
      return scenes.map((s, i) => ({
        order: i,
        visualDescription: s.currentVisual || '',
        motionDescription: s.currentMotion || 'Static cinematic shot.',
        sceneEnvironment: s.currentEnvironment
      }))
    }
  }
}

export const filmmakerDirector = new FilmmakerDirectorService()
