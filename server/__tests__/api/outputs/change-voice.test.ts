import { describe, it, expect } from 'vitest'
import { prisma } from '../../setup'

type FakeEvent = {
  context: { params: Record<string, string> }
  _body?: any
}

async function loadHandler() {
  // Stub Nitro/H3 auto-imports used by server routes.
  ;(globalThis as any).defineEventHandler = (fn: any) => fn
  ;(globalThis as any).getRouterParam = (event: FakeEvent, key: string) => event?.context?.params?.[key]
  ;(globalThis as any).readBody = async (event: FakeEvent) => event?._body
  ;(globalThis as any).createError = ({ statusCode, message }: { statusCode: number; message: string }) => {
    const err: any = new Error(message)
    err.statusCode = statusCode
    err.data = { message }
    return err
  }

  const mod = await import('../../../api/outputs/[id]/change-voice.post')
  return mod.default as (event: FakeEvent) => Promise<any>
}

describe('POST /api/outputs/[id]/change-voice', () => {
  it('sucesso: configura voz sem targetWPM quando não há cenas', async () => {
    const dossier = await prisma.dossier.create({
      data: { title: 'D', theme: 'T' }
    })
    const output = await prisma.output.create({
      data: {
        dossierId: dossier.id,
        outputType: 'VIDEO_TEASER',
        format: 'teaser',
        duration: 20,
        aspectRatio: '9:16',
        platform: 'YouTube',
        voiceId: null,
        speechConfiguredAt: null,
        targetWPM: 150
      } as any
    })

    const handler = await loadHandler()

    const res = await handler({
      context: { params: { id: output.id } },
      _body: { voiceId: 'voice_123' }
    })

    expect(res.success).toBe(true)
    expect(res.newVoiceId).toBe('voice_123')
    expect(res.scenesCount).toBe(0)

    const saved = await prisma.output.findUnique({ where: { id: output.id } })
    expect(saved?.voiceId).toBe('voice_123')
    expect(saved?.speechConfiguredAt).toBeTruthy()
    expect(saved?.targetWPM).toBe(150) // mantido (legado)
  })

  it('conflito: 409 quando voiceId é o mesmo e targetWPM não foi enviado', async () => {
    const dossier = await prisma.dossier.create({
      data: { title: 'D2', theme: 'T2' }
    })
    const output = await prisma.output.create({
      data: {
        dossierId: dossier.id,
        outputType: 'VIDEO_TEASER',
        format: 'teaser',
        duration: 20,
        aspectRatio: '9:16',
        platform: 'YouTube',
        voiceId: 'same_voice',
        speechConfiguredAt: new Date(),
        targetWPM: 150
      } as any
    })

    const handler = await loadHandler()

    await expect(handler({
      context: { params: { id: output.id } },
      _body: { voiceId: 'same_voice' }
    })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('404: output inexistente', async () => {
    const handler = await loadHandler()
    await expect(handler({
      context: { params: { id: '00000000-0000-0000-0000-000000000000' } },
      _body: { voiceId: 'voice_123' }
    })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('400: voiceId ausente', async () => {
    const dossier = await prisma.dossier.create({
      data: { title: 'D3', theme: 'T3' }
    })
    const output = await prisma.output.create({
      data: {
        dossierId: dossier.id,
        outputType: 'VIDEO_TEASER',
        format: 'teaser',
        duration: 20,
        aspectRatio: '9:16',
        platform: 'YouTube',
        targetWPM: 150
      } as any
    })

    const handler = await loadHandler()
    await expect(handler({
      context: { params: { id: output.id } },
      _body: { }
    })).rejects.toMatchObject({ statusCode: 400 })
  })
})

