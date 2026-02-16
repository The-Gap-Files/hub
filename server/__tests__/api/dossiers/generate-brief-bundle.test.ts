import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../../setup'

// Evitar escrita de arquivos .llm-logs durante testes
vi.mock('../../../utils/llm-debug-logger', () => ({
  logLlmResponse: vi.fn().mockResolvedValue(undefined),
  logLlmError: vi.fn().mockResolvedValue(undefined)
}))

// Evitar dependência de DB em cost log (fire-and-forget)
vi.mock('../../../services/cost-log.service', () => ({
  costLogService: { log: vi.fn().mockResolvedValue(undefined) }
}))

const mockedBundle = {
  version: 'briefBundleV1',
  language: 'pt-BR',
  theme: 'Tema de teste para brief',
  title: 'Dossiê de Teste',
  globalSafety: {
    forbiddenElements: ['arma', 'gore', 'close-up mãos', 'close-up rostos'],
    allowedArtifacts: ['documento', 'selo', 'monitor', 'headline'],
    forbiddenNarrationTerms: [],
    notes: []
  },
  facts: Array.from({ length: 12 }).map((_, i) => ({
    text: `Fato safe ${i + 1} (mecanismo)`,
    sourceRef: 'Fonte 1'
  })),
  roleBriefs: {
    gateway: { contextLevel: 'medium', suggestedFactsMin: 10, suggestedFactsMax: 22, notes: [] },
    'deep-dive': { contextLevel: 'low', suggestedFactsMin: 8, suggestedFactsMax: 16, notes: [] },
    'hook-only': { contextLevel: 'minimal', suggestedFactsMin: 3, suggestedFactsMax: 6, notes: [] }
  }
} as const

// Mock do LLM Factory para não fazer chamadas reais
vi.mock('../../../services/llm/llm-factory', () => ({
  getAssignment: vi.fn().mockResolvedValue({
    taskId: 'briefing-teasers',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.3
  }),
  createLlmForTask: vi.fn().mockResolvedValue({
    withStructuredOutput: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        parsed: mockedBundle,
        raw: {
          usage_metadata: {
            input_tokens: 500,
            output_tokens: 200,
            total_tokens: 700
          }
        }
      })
    })
  })
}))

type FakeEvent = {
  context: { params: Record<string, string> }
  _body?: any
  _headers?: Record<string, string>
}

async function loadHandler() {
  // Stub Nitro/H3 auto-imports used by server routes.
  ;(globalThis as any).defineEventHandler = (fn: any) => fn
  ;(globalThis as any).getRouterParam = (event: FakeEvent, key: string) => event?.context?.params?.[key]
  ;(globalThis as any).readBody = async (event: FakeEvent) => event?._body
  ;(globalThis as any).getHeader = (event: FakeEvent, key: string) => {
    const headers = event?._headers || {}
    const found = Object.entries(headers).find(([k]) => k.toLowerCase() === key.toLowerCase())
    return found?.[1]
  }
  ;(globalThis as any).createError = ({ statusCode, message }: { statusCode: number; message: string }) => {
    const err: any = new Error(message)
    err.statusCode = statusCode
    err.data = { message }
    return err
  }

  const mod = await import('../../../api/dossiers/[id]/generate-brief-bundle.post')
  return mod.default as (event: FakeEvent) => Promise<any>
}

describe('POST /api/dossiers/[id]/generate-brief-bundle', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_KEY = 'test-internal-key'
  })

  it('sucesso: gera brief e persiste no dossiê', async () => {
    const dossier = await prisma.dossier.create({
      data: { title: 'Dossiê de Teste', theme: 'Tema de teste para brief', tags: [] }
    })
    await prisma.dossierSource.create({
      data: {
        dossierId: dossier.id,
        title: 'Fonte 1',
        content: 'Conteúdo da fonte 1...',
        sourceType: 'text',
        order: 0
      } as any
    })

    const handler = await loadHandler()
    const res = await handler({
      context: { params: { id: dossier.id } },
      _headers: { 'x-internal-api-key': 'test-internal-key' },
      _body: { force: true }
    })

    expect(res.success).toBe(true)
    expect(res.dossierId).toBe(dossier.id)
    expect(res.bundleHash).toBeTruthy()
    expect(res.bundle?.version).toBe('briefBundleV1')
    expect(Array.isArray(res.bundle?.facts)).toBe(true)

    const saved = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    expect((saved as any)?.briefBundleV1).toBeTruthy()
    expect((saved as any)?.briefBundleV1Hash).toBeTruthy()
    expect((saved as any)?.briefBundleV1UpdatedAt).toBeTruthy()
  })

  it('negócio: 422 quando dossiê não possui fontes', async () => {
    const dossier = await prisma.dossier.create({
      data: { title: 'Sem fontes', theme: 'Tema vazio', tags: [] }
    })

    const handler = await loadHandler()
    await expect(handler({
      context: { params: { id: dossier.id } },
      _headers: { 'x-internal-api-key': 'test-internal-key' },
      _body: { }
    })).rejects.toMatchObject({ statusCode: 422 })
  })

  it('401: quando INTERNAL_API_KEY está ativo e header ausente', async () => {
    const handler = await loadHandler()
    await expect(handler({
      context: { params: { id: '00000000-0000-0000-0000-000000000000' } },
      _headers: { },
      _body: { }
    })).rejects.toMatchObject({ statusCode: 401 })
  })

  it('403: quando INTERNAL_API_KEY está ativo e header inválido', async () => {
    const handler = await loadHandler()
    await expect(handler({
      context: { params: { id: '00000000-0000-0000-0000-000000000000' } },
      _headers: { 'x-internal-api-key': 'wrong' },
      _body: { }
    })).rejects.toMatchObject({ statusCode: 403 })
  })
})

