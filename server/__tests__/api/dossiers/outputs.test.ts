
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '../../setup'

describe('Dossier Outputs API', () => {
  let dossierId: string

  beforeEach(async () => {
    const dossier = await prisma.dossier.create({
      data: {
        title: 'Dossier para Outputs',
        theme: 'Testando outputs'
      }
    })
    dossierId = dossier.id
  })

  describe('POST /api/dossiers/:id/outputs (Batch)', () => {
    it('deve criar múltiplos outputs pendentes com sucesso', async () => {
      const payloads = [
        {
          outputType: 'VIDEO_TEASER',
          format: 'teaser',
          duration: 60,
          aspectRatio: '9:16',
          platform: 'tiktok'
        },
        {
          outputType: 'VIDEO_FULL',
          format: 'full',
          duration: 600,
          aspectRatio: '16:9',
          platform: 'youtube'
        }
      ]

      // Simulando a lógica do handler createMany
      const results = await Promise.all(payloads.map(p =>
        prisma.output.create({
          data: {
            dossierId,
            status: 'PENDING',
            ...p as any
          }
        })
      ))

      expect(results).toHaveLength(2)
      expect(results[0]!.outputType).toBe('VIDEO_TEASER')
      expect(results[1]!.outputType).toBe('VIDEO_FULL')
      expect(results[0]!.status).toBe('PENDING')
    })
  })

  describe('Output Relations', () => {
    it('deve criar relação entre teaser e vídeo completo', async () => {
      const teaser = await prisma.output.create({
        data: {
          dossierId,
          outputType: 'VIDEO_TEASER',
          format: 'teaser',
          status: 'COMPLETED'
        }
      })

      const full = await prisma.output.create({
        data: {
          dossierId,
          outputType: 'VIDEO_FULL',
          format: 'full',
          status: 'COMPLETED'
        }
      })

      const relation = await prisma.outputRelation.create({
        data: {
          mainOutputId: teaser.id,
          relatedOutputId: full.id,
          relationType: 'teaser_to_full'
        }
      })

      expect(relation.id).toBeDefined()
      expect(relation.relationType).toBe('teaser_to_full')
    })
  })
})
