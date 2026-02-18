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

    if (sections.length === 0) return ''

    return `\n───────────────────────────────────────────
PRODUCTION AWARENESS (contexto do pipeline):
${sections.join('\n\n')}
───────────────────────────────────────────`
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
    const weakWords = ['moody', 'atmospheric', 'gritty', 'eerie', 'dramatic', 'concept art']

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

      // Palavras fracas em visual
      for (const word of weakWords) {
        if (visual.includes(word)) {
          warnings.push(`Cena ${scene.order}: visualDescription contém palavra fraca "${word}"`)
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

      // Word count do visual
      const wordCount = (scene.visualDescription || '').split(/\s+/).filter(Boolean).length
      if (wordCount < 35) {
        warnings.push(`Cena ${scene.order}: visualDescription muito curta (${wordCount} palavras, min 35)`)
      }
      if (wordCount > 70) {
        warnings.push(`Cena ${scene.order}: visualDescription muito longa (${wordCount} palavras, max 70)`)
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

    const userPrompt = `CENAS DO ROTEIRO PARA REFINAR:

${JSON.stringify(
      scenes.map((s, i) => ({
        order: i,
        narration: s.narration,
        environment: s.currentEnvironment || null,
        durationSeconds: s.estimatedDuration
      })),
      null,
      2
    )}
${continuityContext}

TAREFA:
Para CADA cena acima, reescreva os campos visuais e de movimento aplicando suas regras de direção cinematográfica.

NÃO utilize nenhuma descrição visual ou de movimento pré-existente de outros agentes. Baseie TODAS as decisões visuais e de movimento APENAS na narração da cena, no estilo visual base informado e no contexto adicional fornecido.

IMPORTANTE SOBRE QUALIDADE VISUAL E MOVIMENTO:
- Todas as cenas têm duração máxima de 7.5 segundos e devem ser tratadas como UM ÚNICO PLANO CONTÍNUO (um shot).
- Objetos de cenário que deveriam estar parados (mesas, portas, móveis, carros estacionados, paredes, prédios, etc.) NÃO devem se mover nem "andar" sozinhos, a menos que a narração descreva claramente esse movimento.
- Use gerúndios apenas para elementos dinâmicos de ambiente (poeira, fumaça, chuva, cortinas, chamas, neblina, etc.), nunca para mudanças bruscas de posição de objetos sólidos.

Campos a gerar por cena:
- visualDescription: prompt completo para gerar a imagem da cena (em inglês, com estilo visual aplicado). NÃO repita tags do Style Anchor — elas já serão prefixadas automaticamente pelo pipeline.
- motionDescription: descrição técnica do movimento de câmera/sujeito para o modelo de vídeo, explicando claramente como a câmera se move e quais elementos animados existem na cena.

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
