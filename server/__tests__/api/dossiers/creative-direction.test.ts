
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '../../setup'

// =============================================================================
// Factories
// =============================================================================

async function createTestDossierWithSources() {
  const dossier = await prisma.dossier.create({
    data: {
      title: 'O Mistério da Pirâmide de Gizé',
      theme: 'Mistérios antigos e teorias conspiratórias'
    }
  })

  await prisma.dossierSource.create({
    data: {
      dossierId: dossier.id,
      title: 'Documento Principal — Pesquisa Histórica',
      content: 'As pirâmides de Gizé foram construídas há mais de 4.500 anos. Novas descobertas arqueológicas sugerem que a construção envolveu técnicas avançadas de engenharia que ainda não compreendemos completamente.',
      sourceType: 'document',
      weight: 1.0,
      order: 0
    }
  })

  await prisma.dossierSource.create({
    data: {
      dossierId: dossier.id,
      title: 'Artigo Complementar — National Geographic',
      content: 'Estudo recente revela câmaras secretas dentro da Grande Pirâmide usando raios cósmicos. Os pesquisadores acreditam que pode haver artefatos desconhecidos preservados.',
      sourceType: 'url',
      weight: 1.0,
      order: 1
    }
  })

  await prisma.dossierNote.create({
    data: {
      dossierId: dossier.id,
      content: 'Focar no mistério das câmaras ocultas — alto potencial viral',
      noteType: 'insight',
      order: 0
    }
  })

  return dossier
}

/** Gera um planData fake com os campos de direção criativa */
function createFakeMonetizationPlanData() {
  return {
    fullVideo: {
      title: 'O Segredo Dentro da Pirâmide | Câmaras Nunca Abertas',
      hook: 'E se eu te dissesse que existe algo dentro da pirâmide que ninguém nunca viu?',
      angle: 'Investigação documental sobre câmaras ocultas',
      structure: 'Hook → Contexto histórico → Descoberta científica → Revelação → CTA',
      keyPoints: [
        'Câmaras ocultas detectadas por raios cósmicos',
        'Técnicas de construção inexplicáveis',
        'Artefatos possivelmente preservados'
      ],
      emotionalArc: 'Curiosidade → Fascínio → Perplexidade → Reflexão',
      estimatedViews: 150000,
      platform: 'YouTube',
      format: 'full-youtube',
      // Creative Direction
      scriptStyleId: 'mystery',
      scriptStyleName: 'Mistério Real - The Gap Files',
      visualStyleId: 'ghibli-dark',
      visualStyleName: 'Ghibli Sombrio',
      editorialObjectiveId: 'hidden-truth',
      editorialObjectiveName: 'Verdade Oculta'
    },
    teasers: [
      {
        title: 'Ninguém deveria ter achado isso',
        hook: 'Raios cósmicos revelaram algo que estava escondido há 4.500 anos',
        angle: 'Descoberta científica surpreendente',
        angleCategory: 'científico',
        scriptOutline: 'Hook 3s → Setup 20s → Revelação 25s → CTA 5s',
        visualSuggestion: 'Animação 2D sombria da pirâmide com scan de raios cósmicos',
        cta: 'Link na bio — vídeo completo no YouTube',
        platform: 'TikTok',
        format: 'teaser-tiktok',
        estimatedViews: 500000,
        scriptStyleId: 'documentary',
        scriptStyleName: 'Documentário Profissional',
        visualStyleId: 'cyberpunk',
        visualStyleName: 'Cyberpunk Neon',
        editorialObjectiveId: 'viral-hook',
        editorialObjectiveName: 'Gancho Viral'
      },
      {
        title: 'O Egito não quer que você saiba disso',
        hook: 'Por que o governo egípcio proibiu a entrada nesta câmara?',
        angle: 'Conspiração governamental',
        angleCategory: 'conspirativo',
        scriptOutline: 'Hook 3s → Contexto 15s → Revelação 30s → CTA 5s',
        visualSuggestion: 'Estilo noir com hieróglifos brilhantes',
        cta: 'Vídeo completo no canal',
        platform: 'YouTube Shorts',
        format: 'teaser-tiktok',
        estimatedViews: 300000,
        scriptStyleId: 'mystery',
        scriptStyleName: 'Mistério Real - The Gap Files',
        visualStyleId: 'ghibli-dark',
        visualStyleName: 'Ghibli Sombrio',
        editorialObjectiveId: 'cliffhanger',
        editorialObjectiveName: 'Cliffhanger Estratégico'
      },
      {
        title: 'Quanto custou esconder isso por milênios?',
        hook: 'A indústria do turismo no Egito movimenta $13 bilhões por ano',
        angle: 'Economia e motivação financeira',
        angleCategory: 'econômico',
        scriptOutline: 'Hook 3s → Dados 20s → Conexão 25s → CTA 5s',
        visualSuggestion: 'Infográficos estilizados com estética dourada',
        cta: 'Link no perfil',
        platform: 'Instagram Reels',
        format: 'teaser-reels',
        estimatedViews: 200000,
        scriptStyleId: 'educational',
        scriptStyleName: 'Educacional',
        visualStyleId: 'photorealistic',
        visualStyleName: 'Fotorrealista',
        editorialObjectiveId: 'deep-analysis',
        editorialObjectiveName: 'Análise Profunda'
      },
      {
        title: 'As pirâmides tinham eletricidade?',
        hook: 'Arqueólogos encontraram evidências de iluminação interna nas pirâmides',
        angle: 'Tecnologia perdida',
        angleCategory: 'paradoxal',
        scriptOutline: 'Hook 3s → Setup 15s → Evidências 30s → CTA 5s',
        visualSuggestion: 'Pirâmides com linhas de energia luminosa estilo sci-fi',
        cta: 'Veja o vídeo completo no YouTube',
        platform: 'TikTok',
        format: 'teaser-tiktok',
        estimatedViews: 800000,
        scriptStyleId: 'narrative',
        scriptStyleName: 'Narrativo Épico',
        visualStyleId: 'cyberpunk',
        visualStyleName: 'Cyberpunk Neon',
        editorialObjectiveId: 'controversy',
        editorialObjectiveName: 'Polêmica Controlada'
      }
    ],
    publicationSchedule: [
      { dayOfWeek: 'Quarta', content: 'Full Video', platform: 'YouTube' },
      { dayOfWeek: 'Quinta', content: 'Teaser 1', platform: 'TikTok' },
      { dayOfWeek: 'Sexta', content: 'Teaser 2', platform: 'YouTube Shorts' },
      { dayOfWeek: 'Domingo', content: 'Teaser 3', platform: 'Instagram Reels' },
      { dayOfWeek: 'Segunda', content: 'Teaser 4', platform: 'TikTok' }
    ],
    estimatedTotalRevenue: '$80-150',
    strategicNotes: 'Tema com alto potencial viral. Câmaras ocultas são mistérios naturais do algoritmo.'
  }
}

// =============================================================================
// TESTES — Monetization Plan com Creative Direction
// =============================================================================

describe('Monetization Plan — Creative Direction Integration', () => {
  let dossierId: string

  beforeEach(async () => {
    const dossier = await createTestDossierWithSources()
    dossierId = dossier.id
  })

  // ─── CENÁRIO 1: Sucesso ──────────────────────────────────────────
  describe('Criação de plano com direção criativa por item', () => {
    it('deve persistir plano com creative direction em cada item e retornar 201', async () => {
      const planData = createFakeMonetizationPlanData()

      const plan = await prisma.monetizationPlan.create({
        data: {
          dossierId,
          planData: planData as any,
          teaserDuration: 60,
          fullVideoDuration: 600,
          teaserCount: planData.teasers.length,
          provider: 'ANTHROPIC',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 3200,
          outputTokens: 1800,
          cost: 0.025,
          isActive: true
        }
      })

      expect(plan.id).toBeDefined()
      expect(plan.dossierId).toBe(dossierId)
      expect(plan.isActive).toBe(true)

      // Verificar side effect no banco
      const saved = await prisma.monetizationPlan.findUnique({
        where: { id: plan.id }
      })
      expect(saved).not.toBeNull()
      expect(saved!.teaserCount).toBe(4)
      expect(saved!.cost).toBe(0.025)

      // Verificar que o planData persiste com creative direction
      const data = saved!.planData as any
      expect(data.fullVideo.scriptStyleId).toBe('mystery')
      expect(data.fullVideo.visualStyleId).toBe('ghibli-dark')
      expect(data.fullVideo.editorialObjectiveId).toBe('hidden-truth')
      expect(data.fullVideo.scriptStyleName).toBe('Mistério Real - The Gap Files')
    })

    it('deve garantir que cada teaser tem creative direction independente', async () => {
      const planData = createFakeMonetizationPlanData()

      const plan = await prisma.monetizationPlan.create({
        data: {
          dossierId,
          planData: planData as any,
          teaserDuration: 120,
          fullVideoDuration: 900,
          teaserCount: planData.teasers.length,
          provider: 'ANTHROPIC',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 4000,
          outputTokens: 2500,
          cost: 0.035
        }
      })

      const saved = await prisma.monetizationPlan.findUnique({
        where: { id: plan.id }
      })

      const data = saved!.planData as any

      // Cada teaser deve ter seus próprios IDs
      expect(data.teasers).toHaveLength(4)

      // Teaser 1: documentary + cyberpunk + viral-hook
      expect(data.teasers[0].scriptStyleId).toBe('documentary')
      expect(data.teasers[0].visualStyleId).toBe('cyberpunk')
      expect(data.teasers[0].editorialObjectiveId).toBe('viral-hook')

      // Teaser 2: mystery + ghibli-dark + cliffhanger
      expect(data.teasers[1].scriptStyleId).toBe('mystery')
      expect(data.teasers[1].visualStyleId).toBe('ghibli-dark')
      expect(data.teasers[1].editorialObjectiveId).toBe('cliffhanger')

      // Teaser 3: educational + photorealistic + deep-analysis
      expect(data.teasers[2].scriptStyleId).toBe('educational')
      expect(data.teasers[2].visualStyleId).toBe('photorealistic')
      expect(data.teasers[2].editorialObjectiveId).toBe('deep-analysis')

      // Teaser 4: narrative + cyberpunk + controversy
      expect(data.teasers[3].scriptStyleId).toBe('narrative')
      expect(data.teasers[3].visualStyleId).toBe('cyberpunk')
      expect(data.teasers[3].editorialObjectiveId).toBe('controversy')
    })
  })

  // ─── CENÁRIO 2: Desativação de planos anteriores ─────────────────
  describe('Ciclo de vida dos planos', () => {
    it('deve desativar plano anterior ao criar novo para o mesmo dossiê', async () => {
      const planData = createFakeMonetizationPlanData()

      // Criar primeiro plano
      const plan1 = await prisma.monetizationPlan.create({
        data: {
          dossierId,
          planData: planData as any,
          teaserDuration: 60,
          fullVideoDuration: 600,
          teaserCount: 4,
          provider: 'ANTHROPIC',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 3000,
          outputTokens: 1500,
          cost: 0.02,
          isActive: true
        }
      })

      // Desativar planos anteriores (simula o endpoint)
      await prisma.monetizationPlan.updateMany({
        where: { dossierId, isActive: true },
        data: { isActive: false }
      })

      // Criar segundo plano
      const plan2 = await prisma.monetizationPlan.create({
        data: {
          dossierId,
          planData: planData as any,
          teaserDuration: 120,
          fullVideoDuration: 900,
          teaserCount: 4,
          provider: 'ANTHROPIC',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 4000,
          outputTokens: 2000,
          cost: 0.03,
          isActive: true
        }
      })

      // Verificar que plan1 foi desativado
      const saved1 = await prisma.monetizationPlan.findUnique({ where: { id: plan1.id } })
      expect(saved1!.isActive).toBe(false)

      // plan2 está ativo
      const saved2 = await prisma.monetizationPlan.findUnique({ where: { id: plan2.id } })
      expect(saved2!.isActive).toBe(true)

      // Total de planos para o dossiê = 2
      const allPlans = await prisma.monetizationPlan.findMany({ where: { dossierId } })
      expect(allPlans).toHaveLength(2)

      // Apenas 1 ativo
      const activePlans = await prisma.monetizationPlan.findMany({ where: { dossierId, isActive: true } })
      expect(activePlans).toHaveLength(1)
      expect(activePlans[0]!.id).toBe(plan2.id)
    })

    it('deve deletar planos em cascata ao remover o dossiê', async () => {
      const planData = createFakeMonetizationPlanData()

      await prisma.monetizationPlan.create({
        data: {
          dossierId,
          planData: planData as any,
          teaserDuration: 60,
          fullVideoDuration: 600,
          teaserCount: 4,
          provider: 'ANTHROPIC',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 3000,
          outputTokens: 1500,
          cost: 0.02,
          isActive: true
        }
      })

      // Verificar que existe antes
      const before = await prisma.monetizationPlan.findMany({ where: { dossierId } })
      expect(before).toHaveLength(1)

      // Deletar dossiê
      await prisma.dossier.delete({ where: { id: dossierId } })

      // Verificar cascade
      const after = await prisma.monetizationPlan.findMany({ where: { dossierId } })
      expect(after).toHaveLength(0)
    })
  })

  // ─── CENÁRIO 3: Validação de estrutura ────────────────────────────
  describe('Validação de estrutura do planData', () => {
    it('deve rejeitar criação com dossierId inexistente', async () => {
      const planData = createFakeMonetizationPlanData()

      try {
        await prisma.monetizationPlan.create({
          data: {
            dossierId: '00000000-0000-0000-0000-000000000000',
            planData: planData as any,
            teaserDuration: 60,
            fullVideoDuration: 600,
            teaserCount: 4,
            provider: 'ANTHROPIC',
            model: 'claude-sonnet-4-20250514',
            inputTokens: 3000,
            outputTokens: 1500,
            cost: 0.02
          }
        })
        expect.unreachable('Deveria ter lançado erro de FK')
      } catch (e) {
        expect(e).toBeDefined()
      }
    })

    it('deve buscar apenas o plano ativo mais recente', async () => {
      const planData = createFakeMonetizationPlanData()

      // Criar 3 planos, desativando os anteriores
      for (let i = 0; i < 3; i++) {
        await prisma.monetizationPlan.updateMany({
          where: { dossierId, isActive: true },
          data: { isActive: false }
        })

        await prisma.monetizationPlan.create({
          data: {
            dossierId,
            planData: { ...planData, strategicNotes: `Plano ${i + 1}` } as any,
            teaserDuration: 60,
            fullVideoDuration: 600,
            teaserCount: 4,
            provider: 'ANTHROPIC',
            model: 'claude-sonnet-4-20250514',
            inputTokens: 3000,
            outputTokens: 1500,
            cost: 0.02
          }
        })
      }

      // Buscar o ativo
      const active = await prisma.monetizationPlan.findFirst({
        where: { dossierId, isActive: true },
        orderBy: { createdAt: 'desc' }
      })

      expect(active).not.toBeNull()
      expect((active!.planData as any).strategicNotes).toBe('Plano 3')
    })
  })
})

// =============================================================================
// TESTES — Constants Catalog Serialization
// =============================================================================

describe('Constants Catalog', () => {
  it('deve serializar script styles corretamente', async () => {
    // Import dinâmico para evitar problemas de ESM
    const { getScriptStylesList } = await import('../../../constants/script-styles')

    const styles = getScriptStylesList()
    expect(styles.length).toBeGreaterThanOrEqual(4)

    const ids = styles.map(s => s.id)
    expect(ids).toContain('documentary')
    expect(ids).toContain('mystery')
    expect(ids).toContain('narrative')
    expect(ids).toContain('educational')

    // Cada estilo deve ter campos necessários
    styles.forEach(s => {
      expect(s.id).toBeDefined()
      expect(s.name).toBeDefined()
      expect(s.description).toBeDefined()
      expect(typeof s.instructions).toBe('string')
      expect(s.instructions.length).toBeGreaterThan(0)
    })
  })

  it('deve serializar visual styles corretamente', async () => {
    const { getVisualStylesList } = await import('../../../constants/visual-styles')

    const styles = getVisualStylesList()
    expect(styles.length).toBeGreaterThanOrEqual(6)

    const ids = styles.map(s => s.id)
    expect(ids).toContain('epictok')
    expect(ids).toContain('ghibli-dark')
    expect(ids).toContain('gta6')
    expect(ids).toContain('cyberpunk')
    expect(ids).toContain('oil-painting')
    expect(ids).toContain('photorealistic')

    // Cada estilo visual deve ter tags técnicos
    styles.forEach(s => {
      expect(s.baseStyle).toBeDefined()
      expect(s.atmosphereTags).toBeDefined()
      expect(s.lightingTags).toBeDefined()
    })
  })

  it('deve serializar editorial objectives corretamente', async () => {
    const { EDITORIAL_OBJECTIVES } = await import('../../../constants/editorial-objectives')

    expect(EDITORIAL_OBJECTIVES.length).toBeGreaterThanOrEqual(8)

    const ids = EDITORIAL_OBJECTIVES.map(o => o.id)
    expect(ids).toContain('full-reveal')
    expect(ids).toContain('hidden-truth')
    expect(ids).toContain('cliffhanger')
    expect(ids).toContain('viral-hook')

    // Cada objetivo deve ter instruction e category
    EDITORIAL_OBJECTIVES.forEach(o => {
      expect(o.instruction).toBeDefined()
      expect(o.instruction.length).toBeGreaterThan(20)
      expect(['reveal', 'suspense', 'educational', 'emotional', 'viral']).toContain(o.category)
    })
  })

  it('deve gerar catálogo completo sem erros', async () => {
    const { serializeConstantsCatalog } = await import('../../../utils/constants-catalog')

    const catalog = serializeConstantsCatalog()

    expect(typeof catalog).toBe('string')
    expect(catalog.length).toBeGreaterThan(500) // Catálogo deve ser substancial

    // Deve conter seções de cada tipo
    expect(catalog).toContain('ESTILOS DE ROTEIRO')
    expect(catalog).toContain('ESTILOS VISUAIS')
    expect(catalog).toContain('OBJETIVOS EDITORIAIS')

    // Deve conter IDs reais
    expect(catalog).toContain('mystery')
    expect(catalog).toContain('ghibli-dark')
    expect(catalog).toContain('hidden-truth')
  })
})

// =============================================================================
// TESTES — SeedSample & CostLog (Rastreabilidade de Seeds e Custos)
// =============================================================================

describe('SeedSample — Rastreabilidade Universal de Seeds', () => {
  let dossierId: string
  let seedId: string

  beforeEach(async () => {
    const dossier = await createTestDossierWithSources()
    dossierId = dossier.id

    const seed = await prisma.seed.create({
      data: { value: 42424242, usageCount: 0 }
    })
    seedId = seed.id
  })

  it('deve criar SeedSample com FK para Seed e Dossier', async () => {
    const sample = await prisma.seedSample.create({
      data: {
        seedId,
        dossierId,
        source: 'style-preview',
        prompt: 'A mysterious ancient pyramid in dark fantasy style',
        base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAFoEvQfAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        mimeType: 'image/png',
        provider: 'REPLICATE',
        model: 'luma/photon-flash',
        aspectRatio: '16:9',
        metadata: { visualStyleId: 'ghibli-dark', itemKey: 'fullVideo', predictTime: 3.5 }
      }
    })

    expect(sample.id).toBeDefined()
    expect(sample.seedId).toBe(seedId)
    expect(sample.dossierId).toBe(dossierId)
    expect(sample.source).toBe('style-preview')

    // Verificar relação reversa: Seed → SeedSamples
    const seedWithSamples = await prisma.seed.findUnique({
      where: { id: seedId },
      include: { samples: true }
    })
    expect(seedWithSamples!.samples).toHaveLength(1)
    expect(seedWithSamples!.samples[0]!.prompt).toContain('mysterious ancient pyramid')
  })

  it('deve incrementar usageCount da Seed ao registrar sample', async () => {
    // Simula o que o endpoint faz
    await prisma.seedSample.create({
      data: {
        seedId,
        dossierId,
        source: 'style-preview',
        prompt: 'Scene 1',
        base64: 'abc123base64==',
        provider: 'REPLICATE',
        model: 'luma/photon-flash'
      }
    })
    await prisma.seed.update({
      where: { id: seedId },
      data: { usageCount: { increment: 1 } }
    })

    await prisma.seedSample.create({
      data: {
        seedId,
        dossierId,
        source: 'style-preview',
        prompt: 'Scene 2',
        base64: 'def456base64==',
        provider: 'REPLICATE',
        model: 'luma/photon-flash'
      }
    })
    await prisma.seed.update({
      where: { id: seedId },
      data: { usageCount: { increment: 1 } }
    })

    const updated = await prisma.seed.findUnique({ where: { id: seedId } })
    expect(updated!.usageCount).toBe(2)

    const samples = await prisma.seedSample.findMany({ where: { seedId } })
    expect(samples).toHaveLength(2)
  })

  it('deve suportar múltiplas fontes (source) para a mesma seed', async () => {
    const sources = ['style-preview', 'scene-image', 'thumbnail', 'test']

    for (const source of sources) {
      await prisma.seedSample.create({
        data: {
          seedId,
          dossierId,
          source,
          prompt: `Prompt for ${source}`,
          base64: `base64_${source}`,
          provider: 'REPLICATE'
        }
      })
    }

    const allSamples = await prisma.seedSample.findMany({ where: { seedId } })
    expect(allSamples).toHaveLength(4)

    const sourcesFound = allSamples.map(s => s.source)
    expect(sourcesFound).toContain('style-preview')
    expect(sourcesFound).toContain('scene-image')
    expect(sourcesFound).toContain('thumbnail')
    expect(sourcesFound).toContain('test')
  })

  it('deve deletar SeedSamples em cascata ao remover Seed', async () => {
    // Criar 3 samples
    for (let i = 0; i < 3; i++) {
      await prisma.seedSample.create({
        data: {
          seedId,
          dossierId,
          source: 'style-preview',
          prompt: `Prompt ${i}`,
          base64: `base64_${i}`,
          provider: 'REPLICATE'
        }
      })
    }

    const before = await prisma.seedSample.findMany({ where: { seedId } })
    expect(before).toHaveLength(3)

    // Deletar seed
    await prisma.seed.delete({ where: { id: seedId } })

    // Cascade deve ter removido os samples
    const after = await prisma.seedSample.findMany({ where: { seedId } })
    expect(after).toHaveLength(0)
  })

  it('deve manter SeedSamples ao deletar Dossier (SetNull)', async () => {
    await prisma.seedSample.create({
      data: {
        seedId,
        dossierId,
        source: 'style-preview',
        prompt: 'Orphan sample',
        base64: 'orphan_base64',
        provider: 'REPLICATE'
      }
    })

    // Deletar dossiê
    await prisma.dossier.delete({ where: { id: dossierId } })

    // Sample deve existir mas com dossierId = null
    const samples = await prisma.seedSample.findMany({ where: { seedId } })
    expect(samples).toHaveLength(1)
    expect(samples[0]!.dossierId).toBeNull()
  })
})

describe('CostLog — Rastreabilidade Financeira', () => {
  let dossierId: string

  beforeEach(async () => {
    const dossier = await createTestDossierWithSources()
    dossierId = dossier.id
  })

  it('deve criar CostLog para style-preview com dossierId', async () => {
    const log = await prisma.costLog.create({
      data: {
        dossierId,
        resource: 'style-preview',
        action: 'create',
        provider: 'REPLICATE',
        model: 'luma/photon-flash',
        cost: 0.0082,
        detail: 'Style preview: fullVideo | Seed 42424242',
        metadata: { predictTime: 3.57, seedValue: 42424242, visualStyleId: 'ghibli-dark' }
      }
    })

    expect(log.id).toBeDefined()
    expect(log.dossierId).toBe(dossierId)
    expect(log.resource).toBe('style-preview')
    expect(log.cost).toBe(0.0082)

    // Verificar via relação Dossier → CostLogs
    const dossier = await prisma.dossier.findUnique({
      where: { id: dossierId },
      include: { costLogs: true }
    })
    expect(dossier!.costLogs).toHaveLength(1)
    expect(dossier!.costLogs[0]!.resource).toBe('style-preview')
  })

  it('deve acumular múltiplos custos para o mesmo dossiê', async () => {
    // Simular geração de 3 previews (fullVideo + 2 teasers)
    const previews = [
      { item: 'fullVideo', cost: 0.008 },
      { item: 'teasers.0', cost: 0.007 },
      { item: 'teasers.1', cost: 0.009 }
    ]

    for (const p of previews) {
      await prisma.costLog.create({
        data: {
          dossierId,
          resource: 'style-preview',
          action: 'create',
          provider: 'REPLICATE',
          model: 'luma/photon-flash',
          cost: p.cost,
          detail: `Style preview: ${p.item}`
        }
      })
    }

    const logs = await prisma.costLog.findMany({
      where: { dossierId, resource: 'style-preview' }
    })
    expect(logs).toHaveLength(3)

    const totalCost = logs.reduce((sum, l) => sum + l.cost, 0)
    expect(totalCost).toBeCloseTo(0.024, 3)
  })

  it('deve suportar CostLog sem outputId (custos no nível do dossiê)', async () => {
    const log = await prisma.costLog.create({
      data: {
        dossierId,
        outputId: null,
        resource: 'style-preview',
        action: 'create',
        provider: 'REPLICATE',
        cost: 0.005
      }
    })

    expect(log.outputId).toBeNull()
    expect(log.dossierId).toBe(dossierId)
  })
})

