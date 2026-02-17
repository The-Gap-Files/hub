/**
 * Filmmaker Director Service (Agente Cineasta)
 *
 * Pós-processamento criativo: lê o roteiro gerado pelo Roteirista e
 * refina os campos visuais (visualDescription, endVisualDescription)
 * e a coreografia de movimento (motionDescription) para garantir
 * qualidade cinematográfica na geração de imagem e vídeo IA.
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
  currentEndVisual?: string
  currentMotion?: string
  currentEnvironment?: string
  estimatedDuration: number
}

interface RefinedScene {
  order: number
  visualDescription: string
  endVisualDescription?: string
  motionDescription: string
  sceneEnvironment?: string
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
   * Refina as cenas aplicando direção de fotografia e movimento
   */
  async refineScript(
    scenes: SceneInput[],
    baseStyle: string,
    context?: string
  ): Promise<RefinedScene[]> {
    const log = createPipelineLogger({ stage: 'Filmmaker', outputId: 'director' })

    // 1. Carregar a Skill (System Prompt)
    const skillContent = await this.loadSkill()

    // 2. Preparar o System Message (persona + regras)
    const systemPrompt = `${skillContent}

───────────────────────────────────────────
ESTILO VISUAL BASE (USE SEMPRE COMO PRIMEIRO ELEMENTO):
"${baseStyle}"
───────────────────────────────────────────
${context ? `\nCONTEXTO ADICIONAL:\n${context}` : ''}`

    // 3. Preparar o User Message (cenas para refinar)
    const userPrompt = `CENAS DO ROTEIRO PARA REFINAR:

${JSON.stringify(scenes.map((s, i) => ({
      order: i,
      narration: s.narration,
      draftVisual: s.currentVisual || '(sem rascunho)',
      draftEndVisual: s.currentEndVisual || null,
      draftMotion: s.currentMotion || null,
      environment: s.currentEnvironment || null,
      durationSeconds: s.estimatedDuration
    })), null, 2)}

TAREFA:
Para CADA cena acima, reescreva os campos visuais e de movimento aplicando suas regras de direção cinematográfica.
- visualDescription: prompt completo para gerar a imagem INICIAL da cena
- endVisualDescription: prompt para a imagem FINAL da cena (se houver transição visual; null se o enquadramento for estático)
- motionDescription: descrição técnica do movimento de câmera/sujeito para o modelo de vídeo

Retorne APENAS um JSON válido (sem markdown, sem explicações):
{
  "scenes": [
    { "order": 0, "visualDescription": "...", "endVisualDescription": "..." | null, "motionDescription": "..." }
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
      return parsed.scenes
    } catch (error) {
      console.error('[FilmmakerDirector] Falha ao parsear JSON do LLM:', error)
      console.error('[FilmmakerDirector] Resposta Raw (primeiros 500 chars):', rawText.slice(0, 500))

      // Fallback seguro: retorna as cenas originais sem alteração
      return scenes.map((s, i) => ({
        order: i,
        visualDescription: s.currentVisual || '',
        motionDescription: s.currentMotion || 'Static cinematic shot.',
        endVisualDescription: s.currentEndVisual,
        sceneEnvironment: s.currentEnvironment
      }))
    }
  }
}

export const filmmakerDirector = new FilmmakerDirectorService()
