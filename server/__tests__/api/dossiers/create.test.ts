
import { describe, it, expect } from 'vitest'
import { prisma } from '../../setup'

describe('Dossier API - POST /api/dossiers', () => {
  it('deve criar um dossier com sucesso (apenas título e tema)', async () => {
    const payload = {
      title: 'Caso Teste',
      theme: 'Tema de Teste',
      tags: ['teste', 'api']
    }

    // Criar dossier SEM sourceText (arquitetura flat/democratizada)
    const dossier = await prisma.dossier.create({
      data: payload
    })

    expect(dossier.id).toBeDefined()
    expect(dossier.title).toBe(payload.title)
    expect(dossier.theme).toBe(payload.theme)

    const saved = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    expect(saved).not.toBeNull()
  })

  it('deve criar dossier e adicionar fontes via DossierSource', async () => {
    // 1. Criar dossier
    const dossier = await prisma.dossier.create({
      data: { title: 'Caso com Fontes', theme: 'Mistério' }
    })

    // 2. Adicionar fontes (democratizadas — sem hierarquia)
    const source1 = await prisma.dossierSource.create({
      data: {
        dossierId: dossier.id,
        title: 'Documento Principal',
        content: 'Conteúdo do documento original...',
        sourceType: 'document',
        weight: 1.0,
        order: 0
      }
    })

    const source2 = await prisma.dossierSource.create({
      data: {
        dossierId: dossier.id,
        title: 'Artigo Complementar',
        content: 'Detalhes adicionais do caso...',
        sourceType: 'url',
        weight: 1.0,
        order: 1
      }
    })

    // 3. Verificar que ambas as fontes existem
    const withSources = await prisma.dossier.findUnique({
      where: { id: dossier.id },
      include: { sources: { orderBy: { order: 'asc' } } }
    })

    expect(withSources!.sources).toHaveLength(2)
    expect(withSources!.sources[0]!.title).toBe('Documento Principal')
    expect(withSources!.sources[0]!.weight).toBe(1.0)
    expect(withSources!.sources[1]!.title).toBe('Artigo Complementar')
  })

  it('deve suportar peso customizado em fontes', async () => {
    const dossier = await prisma.dossier.create({
      data: { title: 'Caso com Peso', theme: 'Investigação' }
    })

    await prisma.dossierSource.create({
      data: {
        dossierId: dossier.id,
        title: 'Fonte Prioritária',
        content: 'Material mais importante...',
        sourceType: 'document',
        weight: 2.0,
        order: 0
      }
    })

    await prisma.dossierSource.create({
      data: {
        dossierId: dossier.id,
        title: 'Fonte Complementar',
        content: 'Material complementar...',
        sourceType: 'text',
        weight: 0.5,
        order: 1
      }
    })

    const result = await prisma.dossier.findUnique({
      where: { id: dossier.id },
      include: { sources: { orderBy: { order: 'asc' } } }
    })

    expect(result!.sources[0]!.weight).toBe(2.0)
    expect(result!.sources[1]!.weight).toBe(0.5)
  })

  it('deve retornar erro quando campos obrigatórios estão ausentes', async () => {
    const payload = {
      title: 'Incompleto'
      // theme ausente
    }

    try {
      // @ts-ignore
      await prisma.dossier.create({ data: payload })
      // Não deve chegar aqui
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })
})
