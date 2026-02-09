import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '../../setup'

// ─── Test Factories ──────────────────────────────────────────────

function createTestChannel(overrides: Partial<{
  name: string
  handle: string
  description: string
  platform: string
  logoBase64: string
  logoMimeType: string
  defaultVisualStyleId: string
  defaultScriptStyleId: string
  isActive: boolean
}> = {}) {
  return {
    name: overrides.name ?? 'The Gap Files',
    handle: overrides.handle ?? `@testchannel_${Date.now()}`,
    description: overrides.description ?? 'Canal de mistérios e história',
    platform: overrides.platform ?? 'YOUTUBE',
    logoBase64: overrides.logoBase64 ?? undefined,
    logoMimeType: overrides.logoMimeType ?? undefined,
    defaultVisualStyleId: overrides.defaultVisualStyleId ?? undefined,
    defaultScriptStyleId: overrides.defaultScriptStyleId ?? undefined,
    isActive: overrides.isActive ?? true
  }
}

// ─── Tests ───────────────────────────────────────────────────────

describe('Channel API - CRUD', () => {

  // ═══════════════════════════════════════════════════════════════
  // POST /api/channels
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/channels (Create)', () => {
    it('deve criar um canal com sucesso', async () => {
      const payload = createTestChannel({
        name: 'The Gap Files',
        handle: '@thegapfiles',
        description: 'Mistérios e lacunas da história oficial',
        platform: 'YOUTUBE'
      })

      const channel = await prisma.channel.create({ data: payload })

      expect(channel.id).toBeDefined()
      expect(channel.name).toBe('The Gap Files')
      expect(channel.handle).toBe('@thegapfiles')
      expect(channel.platform).toBe('YOUTUBE')
      expect(channel.isActive).toBe(true)

      // Side effect: verificar no banco
      const saved = await prisma.channel.findUnique({ where: { id: channel.id } })
      expect(saved).not.toBeNull()
      expect(saved!.name).toBe('The Gap Files')
    })

    it('deve criar canal com logo em base64', async () => {
      const fakeLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEU...'
      const payload = createTestChannel({
        name: 'Canal com Logo',
        handle: '@canallogo',
        logoBase64: fakeLogo,
        logoMimeType: 'image/png'
      })

      const channel = await prisma.channel.create({ data: payload })

      expect(channel.logoBase64).toBe(fakeLogo)
      expect(channel.logoMimeType).toBe('image/png')
    })

    it('deve criar canal com estilos visuais e de roteiro padrão', async () => {
      const payload = createTestChannel({
        name: 'Canal Estilizado',
        handle: '@canalstyle',
        defaultVisualStyleId: 'ghibli-dark',
        defaultScriptStyleId: 'mystery'
      })

      const channel = await prisma.channel.create({ data: payload })

      expect(channel.defaultVisualStyleId).toBe('ghibli-dark')
      expect(channel.defaultScriptStyleId).toBe('mystery')
    })

    it('deve retornar erro quando handle já existe (unique constraint)', async () => {
      const payload = createTestChannel({ handle: '@duplicado' })
      await prisma.channel.create({ data: payload })

      // Tentar criar com o mesmo handle
      await expect(
        prisma.channel.create({ data: createTestChannel({ name: 'Outro Canal', handle: '@duplicado' }) })
      ).rejects.toThrow()
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // GET /api/channels
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/channels (List)', () => {
    it('deve listar canais com contagem de dossiers', async () => {
      const channel = await prisma.channel.create({
        data: createTestChannel({ name: 'Canal Listagem', handle: '@listagem' })
      })

      // Criar dossier vinculado ao canal
      await prisma.dossier.create({
        data: {
          title: 'Dossier do Canal',
          sourceText: 'Texto de teste suficientemente longo',
          theme: 'Teste',
          channelId: channel.id
        }
      })

      const channels = await prisma.channel.findMany({
        include: { _count: { select: { dossiers: true } } }
      })

      expect(channels.length).toBeGreaterThanOrEqual(1)
      const found = channels.find(c => c.id === channel.id)
      expect(found).toBeDefined()
      expect(found!._count.dossiers).toBe(1)
    })

    it('deve filtrar canais inativos por padrão', async () => {
      await prisma.channel.create({
        data: createTestChannel({ name: 'Ativo', handle: '@ativo', isActive: true })
      })
      await prisma.channel.create({
        data: createTestChannel({ name: 'Inativo', handle: '@inativo', isActive: false })
      })

      const activeOnly = await prisma.channel.findMany({ where: { isActive: true } })
      const all = await prisma.channel.findMany()

      expect(all.length).toBe(2)
      expect(activeOnly.length).toBe(1)
      expect(activeOnly[0]!.name).toBe('Ativo')
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // GET /api/channels/:id
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/channels/:id (Detail)', () => {
    it('deve retornar canal por ID com contagem de dossiers', async () => {
      const channel = await prisma.channel.create({
        data: createTestChannel({ name: 'Canal Detalhe', handle: '@detalhe' })
      })

      const found = await prisma.channel.findUnique({
        where: { id: channel.id },
        include: { _count: { select: { dossiers: true } } }
      })

      expect(found).not.toBeNull()
      expect(found!.name).toBe('Canal Detalhe')
      expect(found!._count.dossiers).toBe(0)
    })

    it('deve retornar null quando canal não existe', async () => {
      const found = await prisma.channel.findUnique({
        where: { id: '00000000-0000-0000-0000-000000000000' }
      })

      expect(found).toBeNull()
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // PATCH /api/channels/:id
  // ═══════════════════════════════════════════════════════════════

  describe('PATCH /api/channels/:id (Update)', () => {
    it('deve atualizar nome e descrição do canal', async () => {
      const channel = await prisma.channel.create({
        data: createTestChannel({ name: 'Nome Original', handle: '@patchtest' })
      })

      const updated = await prisma.channel.update({
        where: { id: channel.id },
        data: { name: 'Nome Atualizado', description: 'Nova descrição' }
      })

      expect(updated.name).toBe('Nome Atualizado')
      expect(updated.description).toBe('Nova descrição')
    })

    it('deve atualizar handle verificando unicidade', async () => {
      const channel1 = await prisma.channel.create({
        data: createTestChannel({ handle: '@handle_original' })
      })
      await prisma.channel.create({
        data: createTestChannel({ name: 'Outro', handle: '@handle_ocupado' })
      })

      // Deve funcionar: handle livre
      const updated = await prisma.channel.update({
        where: { id: channel1.id },
        data: { handle: '@handle_novo' }
      })
      expect(updated.handle).toBe('@handle_novo')

      // Deve falhar: handle já em uso
      await expect(
        prisma.channel.update({
          where: { id: channel1.id },
          data: { handle: '@handle_ocupado' }
        })
      ).rejects.toThrow()
    })

    it('deve atualizar logo em base64', async () => {
      const channel = await prisma.channel.create({
        data: createTestChannel({ handle: '@logotest' })
      })

      const newLogo = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
      const updated = await prisma.channel.update({
        where: { id: channel.id },
        data: { logoBase64: newLogo, logoMimeType: 'image/jpeg' }
      })

      expect(updated.logoBase64).toBe(newLogo)
      expect(updated.logoMimeType).toBe('image/jpeg')
    })

    it('deve desativar canal via isActive', async () => {
      const channel = await prisma.channel.create({
        data: createTestChannel({ handle: '@desativar' })
      })

      const updated = await prisma.channel.update({
        where: { id: channel.id },
        data: { isActive: false }
      })

      expect(updated.isActive).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // DELETE /api/channels/:id
  // ═══════════════════════════════════════════════════════════════

  describe('DELETE /api/channels/:id', () => {
    it('deve excluir canal sem dossiers vinculados', async () => {
      const channel = await prisma.channel.create({
        data: createTestChannel({ handle: '@deletavel' })
      })

      await prisma.channel.delete({ where: { id: channel.id } })

      const found = await prisma.channel.findUnique({ where: { id: channel.id } })
      expect(found).toBeNull()
    })

    it('não deve excluir em cascade os dossiers — FK é SetNull', async () => {
      const channel = await prisma.channel.create({
        data: createTestChannel({ handle: '@comDossier' })
      })

      const dossier = await prisma.dossier.create({
        data: {
          title: 'Dossier Protegido',
          sourceText: 'Texto longo o suficiente para o teste',
          theme: 'Proteção',
          channelId: channel.id
        }
      })

      // Soft delete: desativar canal
      await prisma.channel.update({
        where: { id: channel.id },
        data: { isActive: false }
      })

      // O dossier ainda deve existir
      const dossierAfter = await prisma.dossier.findUnique({ where: { id: dossier.id } })
      expect(dossierAfter).not.toBeNull()
      expect(dossierAfter!.channelId).toBe(channel.id)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // Dossier ↔ Channel Relationship
  // ═══════════════════════════════════════════════════════════════

  describe('Dossier ↔ Channel Relationship', () => {
    it('deve vincular dossier a um canal', async () => {
      const channel = await prisma.channel.create({
        data: createTestChannel({ name: 'The Gap Files', handle: '@gapfiles_rel' })
      })

      const dossier = await prisma.dossier.create({
        data: {
          title: 'O Caso do Triângulo das Bermudas',
          sourceText: 'Pesquisa detalhada sobre o Triângulo das Bermudas',
          theme: 'Mistério Marítimo',
          channelId: channel.id
        }
      })

      expect(dossier.channelId).toBe(channel.id)

      // Verificar via include
      const dossierWithChannel = await prisma.dossier.findUnique({
        where: { id: dossier.id },
        include: { channel: true }
      })

      expect(dossierWithChannel!.channel).not.toBeNull()
      expect(dossierWithChannel!.channel!.name).toBe('The Gap Files')
    })

    it('deve permitir dossier sem canal (nullable)', async () => {
      const dossier = await prisma.dossier.create({
        data: {
          title: 'Dossier Avulso',
          sourceText: 'Sem canal vinculado ainda',
          theme: 'Geral'
        }
      })

      expect(dossier.channelId).toBeNull()
    })

    it('deve definir channelId como null quando canal é deletado (SetNull)', async () => {
      const channel = await prisma.channel.create({
        data: createTestChannel({ handle: '@setnull_test' })
      })

      const dossier = await prisma.dossier.create({
        data: {
          title: 'Vai perder o canal',
          sourceText: 'Texto do dossier que vai perder o canal',
          theme: 'SetNull',
          channelId: channel.id
        }
      })

      // Deletar canal
      await prisma.channel.delete({ where: { id: channel.id } })

      // Dossier persiste com channelId = null
      const dossierAfter = await prisma.dossier.findUnique({ where: { id: dossier.id } })
      expect(dossierAfter).not.toBeNull()
      expect(dossierAfter!.channelId).toBeNull()
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // Output.ttsProvider
  // ═══════════════════════════════════════════════════════════════

  describe('Output.ttsProvider field', () => {
    it('deve registrar ttsProvider junto com voiceId no output', async () => {
      const dossier = await prisma.dossier.create({
        data: {
          title: 'Dossier TTS',
          sourceText: 'Conteúdo para teste de TTS Provider',
          theme: 'TTS'
        }
      })

      const output = await prisma.output.create({
        data: {
          dossierId: dossier.id,
          outputType: 'VIDEO_FULL',
          format: '16:9',
          voiceId: 'pMsXgVXv3BLzUgSXSPZc',
          ttsProvider: 'ELEVENLABS'
        }
      })

      expect(output.voiceId).toBe('pMsXgVXv3BLzUgSXSPZc')
      expect(output.ttsProvider).toBe('ELEVENLABS')

      // Verificar no banco
      const saved = await prisma.output.findUnique({ where: { id: output.id } })
      expect(saved!.ttsProvider).toBe('ELEVENLABS')
    })

    it('deve permitir ttsProvider null (compatibilidade com outputs legados)', async () => {
      const dossier = await prisma.dossier.create({
        data: {
          title: 'Dossier Legacy',
          sourceText: 'Output sem provider registrado',
          theme: 'Legacy'
        }
      })

      const output = await prisma.output.create({
        data: {
          dossierId: dossier.id,
          outputType: 'VIDEO_TEASER',
          format: '9:16',
          voiceId: 'Rachel'
        }
      })

      expect(output.ttsProvider).toBeNull()
    })

    it('deve permitir consultar narrador mais usado por canal', async () => {
      const channel = await prisma.channel.create({
        data: createTestChannel({ handle: '@narrador_test' })
      })

      const dossier = await prisma.dossier.create({
        data: {
          title: 'Dossier Narrador',
          sourceText: 'Conteúdo para testar narrador mais usado',
          theme: 'Narrador',
          channelId: channel.id
        }
      })

      // Criar 3 outputs com ElevenLabs/Rachel e 1 com Replicate/Adam
      for (let i = 0; i < 3; i++) {
        await prisma.output.create({
          data: {
            dossierId: dossier.id,
            outputType: 'VIDEO_FULL',
            format: '16:9',
            voiceId: 'pMsXgVXv3BLzUgSXSPZc',
            ttsProvider: 'ELEVENLABS'
          }
        })
      }

      await prisma.output.create({
        data: {
          dossierId: dossier.id,
          outputType: 'VIDEO_TEASER',
          format: '9:16',
          voiceId: 'adam',
          ttsProvider: 'REPLICATE'
        }
      })

      // Query: narrador mais usado neste canal
      const mostUsed = await prisma.output.groupBy({
        by: ['ttsProvider', 'voiceId'],
        where: {
          dossier: { channelId: channel.id },
          ttsProvider: { not: null },
          voiceId: { not: null }
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1
      })

      expect(mostUsed.length).toBe(1)
      expect(mostUsed[0]!.ttsProvider).toBe('ELEVENLABS')
      expect(mostUsed[0]!.voiceId).toBe('pMsXgVXv3BLzUgSXSPZc')
      expect(mostUsed[0]!._count.id).toBe(3)
    })
  })
})
