import { describe, it, expect } from 'vitest'
import { buildDossierBlock, estimateDossierTokens, MIN_CACHE_TOKENS } from '../../utils/dossier-prompt-block'
import type { PersonContext, NeuralInsightContext } from '../../utils/format-intelligence-context'

describe('buildDossierBlock', () => {
  const baseDossier = {
    theme: 'O Mistério de Elisa Lam',
    title: 'True Crime: Cecil Hotel',
    sources: [
      { title: 'Wikipedia', content: 'Elisa Lam was a Canadian student...', type: 'web', weight: 1.0 },
      { title: 'FBI Report', content: 'Official investigation concluded...', type: 'document', weight: 1.5 },
      { title: 'Blog Post', content: 'A blogger visited the hotel...', type: 'web', weight: 0.8 }
    ],
    userNotes: [
      'Focar no aspecto psicológico',
      'Mencionar o vídeo do elevador'
    ],
    persons: [
      { name: 'Elisa Lam', role: 'Vítima', description: 'Estudante canadense de 21 anos', relevance: 'primary' },
      { name: 'Cecil Hotel', role: 'Local', description: 'Hotel com histórico sombrio em LA', relevance: 'secondary' }
    ] as PersonContext[],
    neuralInsights: [
      { noteType: 'curiosity', content: 'O vídeo do elevador tem 30M de views no YouTube' },
      { noteType: 'research', content: 'O hotel teve 16 mortes documentadas desde 1927' }
    ] as NeuralInsightContext[]
  }

  it('deve retornar mesma string para mesma entrada (determinístico)', () => {
    const result1 = buildDossierBlock(baseDossier)
    const result2 = buildDossierBlock(baseDossier)
    expect(result1).toBe(result2)
  })

  it('deve retornar mesma string mesmo com referência nova ao objeto', () => {
    const copy = JSON.parse(JSON.stringify(baseDossier))
    const result1 = buildDossierBlock(baseDossier)
    const result2 = buildDossierBlock(copy)
    expect(result1).toBe(result2)
  })

  it('deve ordenar sources por peso descendente', () => {
    const result = buildDossierBlock(baseDossier)
    const fbiIndex = result.indexOf('FBI Report')
    const wikiIndex = result.indexOf('Wikipedia')
    const blogIndex = result.indexOf('Blog Post')
    // FBI (1.5) antes de Wiki (1.0) antes de Blog (0.8)
    expect(fbiIndex).toBeLessThan(wikiIndex)
    expect(wikiIndex).toBeLessThan(blogIndex)
  })

  it('deve incluir todos os blocos na ordem correta', () => {
    const result = buildDossierBlock(baseDossier)
    const themeIndex = result.indexOf('📋 TEMA:')
    const sourcesIndex = result.indexOf('📚 FONTES DO DOSSIÊ')
    const notesIndex = result.indexOf('🧠 INSIGHTS E NOTAS')
    const personsIndex = result.indexOf('👤')
    const insightsIndex = result.indexOf('🧠 INTELIGÊNCIA')

    // Todos presentes
    expect(themeIndex).toBeGreaterThanOrEqual(0)
    expect(sourcesIndex).toBeGreaterThan(0)
    expect(notesIndex).toBeGreaterThan(0)

    // Ordem fixa
    expect(themeIndex).toBeLessThan(sourcesIndex)
    expect(sourcesIndex).toBeLessThan(notesIndex)
  })

  it('deve incluir theme e title', () => {
    const result = buildDossierBlock(baseDossier)
    expect(result).toContain('📋 TEMA: O Mistério de Elisa Lam')
    expect(result).toContain('📋 TÍTULO: True Crime: Cecil Hotel')
  })

  it('deve gerar bloco mínimo só com theme quando não há outros dados', () => {
    const minimal = { theme: 'Tema simples' }
    const result = buildDossierBlock(minimal)
    expect(result).toBe('📋 TEMA: Tema simples')
  })

  it('deve omitir título se não fornecido', () => {
    const noTitle = { ...baseDossier, title: undefined }
    const result = buildDossierBlock(noTitle)
    expect(result).not.toContain('📋 TÍTULO:')
  })

  it('deve omitir sources se array vazio', () => {
    const noSources = { ...baseDossier, sources: [] }
    const result = buildDossierBlock(noSources)
    expect(result).not.toContain('📚 FONTES DO DOSSIÊ')
  })

  it('deve omitir notes se array vazio', () => {
    const noNotes = { ...baseDossier, userNotes: [] }
    const result = buildDossierBlock(noNotes)
    expect(result).not.toContain('🧠 INSIGHTS E NOTAS DO DOSSIÊ')
  })

  it('não deve incluir weight label quando peso é 1.0', () => {
    const equalWeight = {
      theme: 'Test',
      sources: [{ title: 'A', content: 'B', type: 'web', weight: 1.0 }]
    }
    const result = buildDossierBlock(equalWeight)
    expect(result).not.toContain('[peso:')
  })

  it('deve incluir weight label quando peso difere de 1.0', () => {
    const customWeight = {
      theme: 'Test',
      sources: [{ title: 'A', content: 'B', type: 'web', weight: 1.5 }]
    }
    const result = buildDossierBlock(customWeight)
    expect(result).toContain('[peso: 1.5]')
  })
})

describe('estimateDossierTokens', () => {
  it('deve estimar tokens como chars / 4', () => {
    const block = 'a'.repeat(4096)
    expect(estimateDossierTokens(block)).toBe(1024)
  })

  it('deve arredondar para cima', () => {
    const block = 'a'.repeat(5)
    expect(estimateDossierTokens(block)).toBe(2)
  })
})

describe('MIN_CACHE_TOKENS', () => {
  it('deve ser 1024 (mínimo Sonnet/Opus 4)', () => {
    expect(MIN_CACHE_TOKENS).toBe(1024)
  })
})
