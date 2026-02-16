import { describe, it, expect, vi } from 'vitest'
import { prisma } from '../../setup'

vi.mock('../../../services/cost-log.service', () => ({
  costLogService: { log: vi.fn().mockResolvedValue(undefined) }
}))

type Captured = { req: any | null }
const captured: Captured = { req: null }

vi.mock('../../../services/story-architect.service', () => ({
  generateStoryOutline: vi.fn().mockImplementation(async (req: any) => {
    captured.req = req
    return {
      outline: {
        hookVariants: [
          { level: 'green', hook: 'x', rationale: 'r' },
          { level: 'moderate', hook: 'x', rationale: 'r' },
          { level: 'aggressive', hook: 'x', rationale: 'r' },
          { level: 'lawless', hook: 'x', rationale: 'r' }
        ],
        promiseSetup: 'setup',
        risingBeats: [
          { order: 1, revelation: 'a', questionAnswered: 'na', newQuestion: 'q', sourceReference: 'micro' }
        ],
        climaxMoment: 'climax',
        resolutionPoints: [],
        ctaApproach: 'cta',
        openLoops: [{ question: 'q', openedAtBeat: 1, closedAtBeat: null }],
        resolutionLevel: 'none'
      },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      provider: 'TEST',
      model: 'test-model'
    }
  })
}))

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

  const mod = await import('../../../api/outputs/[id]/generate-outline.post')
  return mod.default as (event: FakeEvent) => Promise<any>
}

function buildMicroBrief() {
  return {
    version: 'teaserMicroBriefV1',
    narrativeRole: 'hook-only',
    angleCategory: 'cat',
    angle: 'Ângulo',
    facts: [
      { text: 'Fato safe 1', sourceRef: 'Fonte 1' },
      { text: 'Fato safe 2', sourceRef: 'Fonte 1' },
      { text: 'Fato safe 3', sourceRef: 'Fonte 1' },
      { text: 'Fato safe 4', sourceRef: 'Fonte 1' },
      { text: 'Fato safe 5', sourceRef: 'Fonte 1' }
    ],
    forbiddenElements: ['arma', 'gore', 'close-up mãos', 'close-up rostos', 'execução'],
    allowedArtifacts: ['documento', 'selo', 'monitor', 'headline', 'arquivo', 'moedas'],
    notes: ['mecanismo > sintoma']
  }
}

describe('POST /api/outputs/[id]/generate-outline', () => {
  it('teaser com microBriefV1: deve chamar Story Architect com sources=1 (micro-brief) e sem pessoas/insights/researchData', async () => {
    const dossier = await prisma.dossier.create({
      data: { title: 'D', theme: 'Tema', tags: [] }
    })
    await prisma.dossierSource.create({
      data: { dossierId: dossier.id, title: 'Fonte A', content: 'Conteúdo A', sourceType: 'text', order: 0 } as any
    })
    await prisma.dossierNote.create({
      data: { dossierId: dossier.id, content: 'Nota', noteType: 'insight', order: 0 } as any
    })

    const output = await prisma.output.create({
      data: {
        dossierId: dossier.id,
        outputType: 'VIDEO_TEASER',
        format: 'teaser-youtube-shorts',
        platform: 'YouTube Shorts',
        aspectRatio: '9:16',
        duration: 20,
        language: 'pt-BR',
        narrationLanguage: 'pt-BR',
        voiceId: 'v',
        speechConfiguredAt: new Date(),
        targetWPM: 150,
        monetizationContext: {
          itemType: 'teaser',
          title: 'T',
          hook: 'H',
          angle: 'A',
          angleCategory: 'C',
          narrativeRole: 'hook-only',
          microBriefV1: buildMicroBrief(),
          sceneCount: 4
        }
      } as any
    })

    captured.req = null
    const handler = await loadHandler()
    const res = await handler({ context: { params: { id: output.id } }, _body: {} })
    expect(res.success).toBe(true)

    expect(captured.req).toBeTruthy()
    expect(captured.req.sources).toHaveLength(1)
    expect(captured.req.sources[0].type).toBe('brief')
    expect(captured.req.sources[0].title).toContain('Micro-brief')
    expect(Array.isArray(captured.req.persons)).toBe(true)
    expect(captured.req.persons).toHaveLength(0)
    expect(Array.isArray(captured.req.neuralInsights)).toBe(true)
    expect(captured.req.neuralInsights).toHaveLength(0)
    expect(captured.req.researchData).toBeUndefined()
  })

  it('fallback: teaser sem microBriefV1 deve enviar sources do dossiê para o Story Architect', async () => {
    const dossier = await prisma.dossier.create({
      data: { title: 'D2', theme: 'Tema2', tags: [] }
    })
    await prisma.dossierSource.create({
      data: { dossierId: dossier.id, title: 'Fonte 1', content: 'Conteúdo 1', sourceType: 'text', order: 0 } as any
    })
    await prisma.dossierSource.create({
      data: { dossierId: dossier.id, title: 'Fonte 2', content: 'Conteúdo 2', sourceType: 'text', order: 1 } as any
    })

    const output = await prisma.output.create({
      data: {
        dossierId: dossier.id,
        outputType: 'VIDEO_TEASER',
        format: 'teaser-youtube-shorts',
        platform: 'YouTube Shorts',
        aspectRatio: '9:16',
        duration: 35,
        language: 'pt-BR',
        narrationLanguage: 'pt-BR',
        voiceId: 'v',
        speechConfiguredAt: new Date(),
        targetWPM: 150,
        monetizationContext: {
          itemType: 'teaser',
          title: 'T',
          hook: 'H',
          angle: 'A',
          angleCategory: 'C',
          narrativeRole: 'gateway',
          sceneCount: 5
        }
      } as any
    })

    captured.req = null
    const handler = await loadHandler()
    const res = await handler({ context: { params: { id: output.id } }, _body: {} })
    expect(res.success).toBe(true)

    expect(captured.req).toBeTruthy()
    expect(captured.req.sources).toHaveLength(2)
    expect(captured.req.sources[0].type).toBe('text')
  })
})

