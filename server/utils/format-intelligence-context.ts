/**
 * Format Intelligence Context
 * 
 * Helpers reutilizáveis para formatar dados de Persons e Neural Insights
 * para injeção em prompts LLM (Story Architect + Script Providers).
 * 
 * Evita duplicação: mesma lógica de formatação para todos os consumers.
 */

// =============================================================================
// TIPOS
// =============================================================================

export interface PersonContext {
  id?: string
  name: string
  role?: string | null
  description?: string | null
  visualDescription?: string | null
  hasReferenceImage?: boolean
  aliases?: string[]
  relevance: string
}

export interface NeuralInsightContext {
  content: string
  noteType: 'insight' | 'curiosity' | 'research'
}

// =============================================================================
// FORMATTERS
// =============================================================================

/**
 * Formata o bloco de personagens para injeção em prompts LLM.
 * Retorna string vazia se não houver persons.
 */
export function formatPersonsForPrompt(persons: PersonContext[]): string {
  if (!persons?.length) return ''

  let block = `👤 ELENCO DE PERSONAGENS (PESSOAS-CHAVE DO DOSSIÊ):\n`

  persons.forEach((p, i) => {
    block += `[${i + 1}] (${p.relevance}) ${p.name}`
    if (p.role) block += ` — ${p.role}`
    if (p.id) block += ` [ID: ${p.id}]`
    if (p.hasReferenceImage) block += ` [REF_IMG]`
    block += `\n`
    if (p.description) block += `    Descrição: ${p.description}\n`
    if (p.visualDescription) block += `    Visual: ${p.visualDescription}\n`
    if (p.aliases && p.aliases.length > 0) block += `    Aliases: ${p.aliases.join(', ')}\n`
  })

  return block + '\n'
}

/**
 * Formata o bloco de inteligência neural para injeção em prompts LLM.
 * Agrupa por tipo: insights, curiosidades e dados de pesquisa.
 * Retorna string vazia se não houver insights.
 */
export function formatNeuralInsightsForPrompt(insights: NeuralInsightContext[]): string {
  if (!insights?.length) return ''

  const insightItems = insights.filter(n => n.noteType === 'insight')
  const curiosities = insights.filter(n => n.noteType === 'curiosity')
  const research = insights.filter(n => n.noteType === 'research')

  // Se nenhuma categoria tem itens, retorna vazio
  if (insightItems.length === 0 && curiosities.length === 0 && research.length === 0) return ''

  let block = `🧠 INTELIGÊNCIA NEURAL DO DOSSIÊ:\n`

  if (insightItems.length > 0) {
    block += `💡 INSIGHTS:\n`
    insightItems.forEach(n => { block += `  - ${n.content}\n` })
  }
  if (curiosities.length > 0) {
    block += `🔍 CURIOSIDADES:\n`
    curiosities.forEach(n => { block += `  - ${n.content}\n` })
  }
  if (research.length > 0) {
    block += `📊 DADOS DE PESQUISA:\n`
    research.forEach(n => { block += `  - ${n.content}\n` })
  }

  return block + '\n'
}

// =============================================================================
// MAPPERS (Prisma → Context)
// =============================================================================

/**
 * Mapeia DossierPerson[] do Prisma para PersonContext[].
 */
export function mapPersonsFromPrisma(persons: any[]): PersonContext[] {
  if (!persons?.length) return []
  return persons.map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    description: p.description,
    visualDescription: p.visualDescription,
    hasReferenceImage: !!p.referenceImage,
    aliases: p.aliases || [],
    relevance: p.relevance
  }))
}

/**
 * Mapeia DossierNote[] do Prisma para NeuralInsightContext[].
 * Filtra apenas notas com noteType tipado (insight, curiosity, research).
 */
export function mapNeuralInsightsFromNotes(notes: any[]): NeuralInsightContext[] {
  if (!notes?.length) return []
  const validTypes = ['insight', 'curiosity', 'research']
  return notes
    .filter(n => validTypes.includes(n.noteType))
    .map(n => ({
      content: n.content,
      noteType: n.noteType as 'insight' | 'curiosity' | 'research'
    }))
}
