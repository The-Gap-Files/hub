/**
 * Script Styles - Estilos de roteiro para geração via LLM
 * 
 * Os estilos "documentary" e "mystery" são carregados dinamicamente
 * dos arquivos .md em server/skills/ (Single Source of Truth).
 * 
 * Os estilos "narrative" e "educational" permanecem inline até
 * terem skills dedicadas criadas.
 * 
 * IMPORTANTE: O carregamento das skills é LAZY (sob demanda) para
 * evitar I/O síncrono no top-level que quebra a ordem de
 * inicialização do bundle Nitro (erro "Cannot access 'renderer$1'
 * before initialization").
 * 
 * Fluxo: server/skills/*.md → skill-loader → instructions → LangChain → Claude
 * Hierarquia: Classification (pai) → Script (filho) → Visual (neto). defaultVisualStyleId = neto.
 */

import { loadSkillWithIdentity } from '../utils/skill-loader'
import type { VisualStyleId } from './visual-styles'

export type ScriptStyleId = 'documentary' | 'mystery' | 'narrative' | 'educational'

export interface ScriptStyle {
  id: ScriptStyleId
  name: string
  description: string
  instructions: string
  order: number
  isActive: boolean
  /** Filho → Neto: estilo visual recomendado para este estilo de roteiro */
  defaultVisualStyleId?: VisualStyleId
}

// ─── Lazy Skill Loader ──────────────────────────────────────────
// Cache local: carrega da skill apenas na 1ª chamada, evitando
// I/O síncrono durante inicialização do módulo.

let _documentaryInstructions: string | null = null
let _mysteryInstructions: string | null = null
let _narrativeInstructions: string | null = null

function getDocumentaryInstructions(): string {
  if (!_documentaryInstructions) {
    _documentaryInstructions = loadSkillWithIdentity(
      'documentary-storytelling',
      'IDENTIDADE: Você é um documentarista profissional que domina rigor jornalístico, técnicas de retenção e inteligência de plataforma. Você expõe SISTEMAS e MECANISMOS de poder — nunca sintomas ou violência gráfica.'
    )
  }
  return _documentaryInstructions
}

function getMysteryInstructions(): string {
  if (!_mysteryInstructions) {
    _mysteryInstructions = loadSkillWithIdentity(
      'mystery-storytelling',
      'IDENTIDADE: Você é o investigador-chefe do "The Gap Files" — um arquiteto de compulsão narrativa que projeta para algoritmo + humano simultaneamente. Suas narrativas expõem SISTEMAS e MECANISMOS, não sintomas. Perplexidade > repulsa.'
    )
  }
  return _mysteryInstructions
}

function getNarrativeInstructions(): string {
  if (!_narrativeInstructions) {
    _narrativeInstructions = loadSkillWithIdentity(
      'narrative-storytelling',
      'IDENTIDADE: Você é um bardo moderno do "The Gap Files". Suas narrativas transformam eventos históricos em jornadas emocionais profundas onde o SISTEMA de poder é o verdadeiro antagonista — empatia > gore, mecanismo > sintoma, compulsão > pedido.'
    )
  }
  return _narrativeInstructions
}

// ─── Skill-based Styles (carregados LAZY de server/skills/) ─────

export const DOCUMENTARY_STYLE: ScriptStyle = {
  id: 'documentary',
  name: 'Documentário Profissional',
  description: 'Framework documental estruturado para true crime, investigações, perfis, ciência e história. Combina rigor jornalístico com storytelling envolvente e técnicas de retenção comprovadas.',
  get instructions() { return getDocumentaryInstructions() },
  order: 1,
  isActive: true,
  defaultVisualStyleId: 'noir-cinematic'
}

export const MYSTERY_STYLE: ScriptStyle = {
  id: 'mystery',
  name: 'Mistério Real - The Gap Files',
  description: 'Framework viral para mistérios históricos, conspirações e teorias. Fórmula "Gap Glitch" de máxima retenção + técnicas comprovadas de storytelling investigativo.',
  get instructions() { return getMysteryInstructions() },
  order: 2,
  isActive: true,
  defaultVisualStyleId: 'noir-cinematic'
}

// ─── Inline Styles (sem skill .md dedicada ainda) ───────────────

export const NARRATIVE_STYLE: ScriptStyle = {
  id: 'narrative',
  name: 'Narrativo Épico',
  description: 'Framework narrativo épico/emocional para jornadas humanas, dramas históricos e eventos transformadores. Foca na experiência emocional com resolução controlada para teasers.',
  get instructions() { return getNarrativeInstructions() },
  order: 3,
  isActive: true,
  defaultVisualStyleId: 'epictok'
}

export const EDUCATIONAL_STYLE: ScriptStyle = {
  id: 'educational',
  name: 'Educacional',
  description: 'Estilo educativo e envolvente, explicando conceitos complexos de forma acessível. Usa metáforas visuais e analogias sem ser condescendente.',
  instructions: `IDENTIDADE: Você é um professor entusiasta e mestre na clareza, que transforma complexidade em fascinação.

OBJETIVO: Tornar o complexo simples e cativante sem perder profundidade. Educar através de curiosidade genuína.

ESTRUTURA PEDAGÓGICA:
- Pergunta Curiosa (Hook): Comece com uma dúvida universal ou fato surpreendente
  - Exemplo: "Por que o céu é azul?" ou "Você sabia que 90% do seu cérebro está sempre inativo? ERRADO."
  
- Explicação Visual (Desenvolvimento): Use metáforas e analogias concretas
  - Decomponha conceitos complexos em partes
  - Progressão: do simples ao complexo
  - Analogias do cotidiano para conceitos abstratos
  
- Aplicação Prática (Relevância): Como isso afeta o mundo real hoje
  - Conexões com vida diária
  - Exemplos tangíveis
  - "Por isso que quando você..."

TÉCNICAS DIDÁTICAS:
- Evite jargão técnico desnecessário
- Quando usar termos técnicos, explique imediatamente
- Use estrutura "Imagine que..." para abstrações
- Repita conceitos-chave de formas diferentes

ESTILO VISUAL:
- Diagramas e fluxos descritos claramente
- Comparações de escala ("do tamanho de...")
- Cores e formas para categorização
- Animações conceituais descritas passo-a-passo

TOM:
- Entusiasta mas não infantil
- Paciente mas dinâmico
- Curioso junto com o espectador
- Celebra descobertas e "aha moments"

EVITE:
- Condescendência ("é muito simples...")
- Oversimplification que distorce realidade
- Pular etapas lógicas
- Assumir conhecimento prévio sem construir base

VOCABULÁRIO: Imagine, Funciona, Entenda, Por que, Como, Exemplo, Descoberta, Fascinante, Observe, Perceba.

CTA: "Agora que você entende...", "Da próxima vez que você ver..."`,
  order: 4,
  isActive: true,
  defaultVisualStyleId: 'photorealistic'
}

// ─── Registry ────────────────────────────────────────────────────

export const SCRIPT_STYLES: Record<ScriptStyleId, ScriptStyle> = {
  documentary: DOCUMENTARY_STYLE,
  mystery: MYSTERY_STYLE,
  narrative: NARRATIVE_STYLE,
  educational: EDUCATIONAL_STYLE
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Retorna todos os estilos como array ordenado (para API e UI) */
export function getScriptStylesList(): ScriptStyle[] {
  return Object.values(SCRIPT_STYLES)
    .filter(s => s.isActive)
    .sort((a, b) => a.order - b.order)
}

/** Busca estilo por ID (retorna undefined se não encontrar) */
export function getScriptStyleById(id: string): ScriptStyle | undefined {
  return SCRIPT_STYLES[id as ScriptStyleId]
}

/** Retorna todos os IDs válidos */
export function getScriptStyleIds(): ScriptStyleId[] {
  return Object.keys(SCRIPT_STYLES) as ScriptStyleId[]
}
