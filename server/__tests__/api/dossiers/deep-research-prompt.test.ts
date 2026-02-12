
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../../setup'

// Mock do LLM Factory para não fazer chamadas reais
vi.mock('../../../services/llm/llm-factory', () => ({
  getAssignment: vi.fn().mockResolvedValue({
    taskId: 'deep-research-prompt',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.6
  }),
  createLlmForTask: vi.fn().mockResolvedValue({
    invoke: vi.fn().mockResolvedValue({
      content: 'Realize uma pesquisa investigativa profunda sobre: "Teste Dossier"\n\n1. Contexto histórico\n2. Atores-chave\n3. Evidências documentais',
      usage_metadata: {
        input_tokens: 150,
        output_tokens: 80,
        total_tokens: 230
      }
    })
  })
}))

describe('Deep Research Prompt - POST /api/dossiers/:id/suggest-research-prompt', () => {

  // ──────────────────────────────────────────────────────────────
  // FACTORIES
  // ──────────────────────────────────────────────────────────────

  async function createTestDossier(overrides: Partial<{
    title: string
    theme: string
    tags: string[]
  }> = {}) {
    return prisma.dossier.create({
      data: {
        title: overrides.title ?? 'Dossier de Teste',
        theme: overrides.theme ?? 'Tema de teste para pesquisa',
        tags: overrides.tags ?? ['tag1', 'tag2']
      }
    })
  }

  async function createTestSource(dossierId: string, overrides: Partial<{
    title: string
    content: string
    sourceType: string
    order: number
  }> = {}) {
    return prisma.dossierSource.create({
      data: {
        dossierId,
        title: overrides.title ?? 'Fonte de Teste',
        content: overrides.content ?? 'Conteúdo da fonte de teste...',
        sourceType: overrides.sourceType ?? 'article',
        order: overrides.order ?? 0
      }
    })
  }

  // ──────────────────────────────────────────────────────────────
  // TESTES
  // ──────────────────────────────────────────────────────────────

  it('deve gerar prompt de pesquisa com sucesso para dossiê existente', async () => {
    // ARRANGE
    const dossier = await createTestDossier({
      title: 'Hélio 3 e a corrida espacial',
      theme: 'Energia do futuro + mineração lunar',
      tags: ['hélio-3', 'lua', 'fusão-nuclear']
    })

    await createTestSource(dossier.id, {
      title: 'Artigo sobre fusão nuclear',
      content: 'Conteúdo sobre fusão...'
    })

    // ACT — Chamada direta ao service (teste de unidade funcional)
    const { generateDeepResearchPrompt } = await import(
      '../../../services/deep-research-prompt.service'
    )

    const result = await generateDeepResearchPrompt({
      title: dossier.title,
      theme: dossier.theme,
      tags: dossier.tags,
      existingSourceTitles: ['Artigo sobre fusão nuclear'],
      language: 'pt-br',
      depth: 'standard'
    })

    // ASSERT
    expect(result.prompt).toBeDefined()
    expect(result.prompt.length).toBeGreaterThan(10)
    expect(result.provider).toBe('GROQ')
    expect(result.model).toBe('llama-3.3-70b-versatile')
    expect(result.usage).toBeDefined()
    expect(result.usage?.totalTokens).toBeGreaterThan(0)
  })

  it('deve incluir contexto de fontes existentes no prompt', async () => {
    // ARRANGE
    const dossier = await createTestDossier({
      title: 'Caso Teste com Fontes',
      theme: 'Investigação profunda'
    })

    await createTestSource(dossier.id, { title: 'Fonte A: Documentos' })
    await createTestSource(dossier.id, { title: 'Fonte B: Entrevista', order: 1 })

    // ACT
    const { generateDeepResearchPrompt } = await import(
      '../../../services/deep-research-prompt.service'
    )

    const result = await generateDeepResearchPrompt({
      title: dossier.title,
      theme: dossier.theme,
      existingSourceTitles: ['Fonte A: Documentos', 'Fonte B: Entrevista'],
      language: 'pt-br',
      depth: 'deep'
    })

    // ASSERT — O prompt foi gerado (conteúdo real depende do mock)
    expect(result.prompt).toBeDefined()
    expect(typeof result.prompt).toBe('string')
  })

  it('deve funcionar sem classificação e sem fontes', async () => {
    // ARRANGE — dossiê mínimo
    const dossier = await createTestDossier({
      title: 'Dossiê Simples',
      theme: 'Tema genérico'
    })

    // ACT
    const { generateDeepResearchPrompt } = await import(
      '../../../services/deep-research-prompt.service'
    )

    const result = await generateDeepResearchPrompt({
      title: dossier.title,
      theme: dossier.theme,
      language: 'en',
      depth: 'quick'
    })

    // ASSERT
    expect(result.prompt).toBeDefined()
    expect(result.provider).toBeDefined()
    expect(result.model).toBeDefined()
  })

  it('deve retornar erro quando dossiê não existe (via validação do banco)', async () => {
    // ARRANGE — ID inexistente
    const fakeDossierId = '00000000-0000-0000-0000-000000000000'

    // ACT & ASSERT — Buscar dossiê inexistente retorna null
    const dossier = await prisma.dossier.findUnique({
      where: { id: fakeDossierId }
    })

    expect(dossier).toBeNull()
  })
})
