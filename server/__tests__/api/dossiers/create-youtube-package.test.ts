import { describe, it, expect } from 'vitest'
import { prisma } from '../../setup'

type FakeEvent = {
  context: { params: Record<string, string> }
  _body?: any
}

async function loadHandler() {
  ;(globalThis as any).defineEventHandler = (fn: any) => fn
  ;(globalThis as any).getRouterParam = (event: FakeEvent, key: string) => event?.context?.params?.[key]
  ;(globalThis as any).readBody = async (event: FakeEvent) => event?._body
  ;(globalThis as any).createError = ({ statusCode, message }: { statusCode: number; message: string }) => {
    const err: any = new Error(message)
    err.statusCode = statusCode
    err.data = { message }
    return err
  }

  const mod = await import('../../../api/dossiers/[id]/create-youtube-package.post')
  return mod.default as (event: FakeEvent) => Promise<any>
}

function buildMicroBrief(i: number, role: 'gateway' | 'deep-dive' | 'hook-only') {
  return {
    version: 'teaserMicroBriefV1',
    narrativeRole: role,
    angleCategory: `angle_cat_${i}`,
    angle: `Ângulo ${i}`,
    facts: [
      { text: `Fato ${i}-1`, sourceRef: 'Fonte 1' },
      { text: `Fato ${i}-2`, sourceRef: 'Fonte 1' },
      { text: `Fato ${i}-3`, sourceRef: 'Fonte 1' },
      { text: `Fato ${i}-4`, sourceRef: 'Fonte 1' },
      { text: `Fato ${i}-5`, sourceRef: 'Fonte 1' }
    ],
    forbiddenElements: ['arma', 'gore', 'close-up mãos', 'close-up rostos', 'execução'],
    allowedArtifacts: ['documento', 'selo', 'monitor', 'headline', 'arquivo', 'moedas'],
    notes: ['mecanismo > sintoma', 'sem resolução']
  }
}

describe('POST /api/dossiers/[id]/create-youtube-package', () => {
  it('deve persistir monetizationContext.microBriefV1 em todos os teasers do pacote', async () => {
    const dossier = await prisma.dossier.create({
      data: { title: 'Dossiê', theme: 'Tema', tags: [] }
    })

    const teasers = Array.from({ length: 12 }).map((_, idx) => {
      const i = idx + 1
      const role = i === 1 ? 'gateway' : (i % 3 === 0 ? 'hook-only' : 'deep-dive')
      return {
        title: `Teaser ${i}`,
        hook: `Hook ${i}`,
        angle: `Ângulo ${i}`,
        angleCategory: `angle_cat_${i}`,
        narrativeRole: role,
        shortFormatType: 'plot-twist',
        microBriefV1: buildMicroBrief(i, role as any),
        scriptOutline: role === 'hook-only'
          ? 'Loop-B → Respiro → Replay bait → Loop-A'
          : 'Hook → Beat → Gap → CTA',
        visualSuggestion: 'Documentos e sombras',
        cta: role === 'hook-only' ? null : 'The Gap Files.',
        platform: 'YouTube Shorts',
        format: 'teaser-youtube-shorts',
        estimatedViews: 1234,
        scriptStyleId: 'documentary',
        scriptStyleName: 'Documentary',
        editorialObjectiveId: 'viral-hook',
        editorialObjectiveName: 'Viral Hook',
        avoidPatterns: ['não explicar', 'não resolver'],
        visualPrompt: 'Cinematic 2D illustration, documentary noir, archive room, parchment, wax seal.',
        sceneCount: role === 'hook-only' ? 4 : role === 'gateway' ? 5 : 6
      }
    })

    const plan = await prisma.monetizationPlan.create({
      data: {
        dossierId: dossier.id,
        teaserDuration: 35,
        fullVideoDuration: 900,
        teaserCount: 12,
        provider: 'TEST',
        model: null,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        isActive: true,
        planData: {
          planTitle: 'Plano',
          visualStyleId: 'noir-cinematic',
          visualStyleName: 'Noir Cinematic',
          strategicNotes: 'Notas',
          estimatedTotalRevenue: '0',
          publicationSchedule: [],
          fullVideo: {
            title: 'Full Title',
            hook: 'Full hook',
            angle: 'Full angle',
            structure: 'Estrutura',
            keyPoints: ['a', 'b', 'c'],
            emotionalArc: 'Arc',
            estimatedViews: 999,
            platform: 'YouTube',
            format: 'full-youtube',
            scriptStyleId: 'documentary',
            scriptStyleName: 'Documentary',
            editorialObjectiveId: 'hidden-truth',
            editorialObjectiveName: 'Hidden Truth',
            visualPrompt: 'Noir documentary',
            sceneCount: 150
          },
          teasers
        } as any
      }
    })

    const handler = await loadHandler()
    const res = await handler({
      context: { params: { id: dossier.id } },
      _body: { planId: plan.id }
    })

    expect(res.success).toBe(true)
    expect(res.fullOutputId).toBeTruthy()
    expect(Array.isArray(res.teaserOutputIds)).toBe(true)
    expect(res.teaserOutputIds).toHaveLength(12)

    const outputs = await prisma.output.findMany({
      where: { id: { in: res.teaserOutputIds } },
      select: { id: true, monetizationContext: true }
    })

    // Validar que cada teaser tem microBriefV1 persistido
    for (const o of outputs) {
      const mc: any = o.monetizationContext
      expect(mc?.itemType).toBe('teaser')
      expect(mc?.microBriefV1).toBeTruthy()
      expect(mc?.microBriefV1?.version).toBe('teaserMicroBriefV1')
      expect(Array.isArray(mc?.microBriefV1?.facts)).toBe(true)
      expect(mc.microBriefV1.facts.length).toBeGreaterThanOrEqual(5)
    }
  })
})

