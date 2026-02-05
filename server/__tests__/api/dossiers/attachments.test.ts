
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '../../setup'
import { compressBuffer } from '../../../utils/compression'

describe('Dossier Attachments API', () => {
  let dossierId: string

  beforeEach(async () => {
    const dossier = await prisma.dossier.create({
      data: {
        title: 'Dossier para Anexos',
        theme: 'Testando anexos',
        sourceText: 'Um texto longo o suficiente para passar na validação do zod.'
      }
    })
    dossierId = dossier.id
  })

  describe('POST /api/dossiers/:id/sources', () => {
    it('deve adicionar uma fonte secundária com sucesso', async () => {
      const payload = {
        title: 'Artigo Científico',
        content: 'Conteúdo detalhado da fonte...',
        sourceType: 'paper',
        url: 'https://exemplo.com/artigo',
        author: 'Dr. Teste'
      }

      const source = await prisma.dossierSource.create({
        data: {
          dossierId,
          ...payload
        }
      })

      expect(source.id).toBeDefined()
      expect(source.title).toBe(payload.title)
      expect(source.dossierId).toBe(dossierId)
    })
  })

  describe('POST /api/dossiers/:id/images', () => {
    it('deve adicionar uma imagem de referência comprimida', async () => {
      const fakeImageData = Buffer.from('fake-image-data-test-123')
      const compressedData = await compressBuffer(fakeImageData)

      const image = await prisma.dossierImage.create({
        data: {
          dossierId,
          description: 'Foto de Trento em 1475',
          imageData: compressedData,
          mimeType: 'image/png',
          tags: 'história, mapa'
        }
      })

      expect(image.id).toBeDefined()
      expect(image.description).toContain('Trento')
      expect(image.imageData).toBeDefined()
    })
  })

  describe('POST /api/dossiers/:id/notes', () => {
    it('deve adicionar uma nota de research', async () => {
      const payload = {
        content: 'Insight importante sobre a conexão entre os fatos.',
        noteType: 'insight'
      }

      const note = await prisma.dossierNote.create({
        data: {
          dossierId,
          ...payload
        }
      })

      expect(note.id).toBeDefined()
      expect(note.content).toBe(payload.content)
      expect(note.noteType).toBe('insight')
    })
  })
})
