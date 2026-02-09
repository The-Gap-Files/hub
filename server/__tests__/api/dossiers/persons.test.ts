
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '../../setup'

describe('Dossier Persons API', () => {
  let dossierId: string

  beforeEach(async () => {
    const dossier = await prisma.dossier.create({
      data: {
        title: 'Caso Kennedy',
        theme: 'Assassinato e conspiração'
      }
    })
    dossierId = dossier.id
  })

  describe('POST /api/dossiers/:id/persons — Criação via Prisma', () => {
    it('deve criar uma pessoa-chave com sucesso', async () => {
      const payload = {
        name: 'John F. Kennedy',
        role: 'vítima',
        description: 'Presidente dos EUA assassinado em Dallas, Texas, em 22 de novembro de 1963.',
        visualDescription: 'Homem caucasiano, ~46 anos, cabelo castanho penteado, terno escuro, gravata, expressão confiante',
        aliases: ['JFK', 'Jack Kennedy'],
        relevance: 'primary' as const
      }

      const person = await prisma.dossierPerson.create({
        data: {
          dossierId,
          ...payload
        }
      })

      expect(person.id).toBeDefined()
      expect(person.name).toBe(payload.name)
      expect(person.role).toBe('vítima')
      expect(person.relevance).toBe('primary')
      expect(person.aliases).toEqual(['JFK', 'Jack Kennedy'])
      expect(person.visualDescription).toContain('caucasiano')
      expect(person.dossierId).toBe(dossierId)

      // Verificar side effect no banco
      const saved = await prisma.dossierPerson.findUnique({ where: { id: person.id } })
      expect(saved).not.toBeNull()
      expect(saved!.name).toBe('John F. Kennedy')
    })

    it('deve criar pessoa com campos mínimos (apenas nome)', async () => {
      const person = await prisma.dossierPerson.create({
        data: {
          dossierId,
          name: 'Lee Harvey Oswald'
        }
      })

      expect(person.id).toBeDefined()
      expect(person.name).toBe('Lee Harvey Oswald')
      expect(person.role).toBeNull()
      expect(person.relevance).toBe('secondary') // default
      expect(person.aliases).toEqual([])
    })

    it('deve rejeitar criação com dossierId inexistente', async () => {
      try {
        await prisma.dossierPerson.create({
          data: {
            dossierId: '00000000-0000-0000-0000-000000000000',
            name: 'Fantasma'
          }
        })
        expect.unreachable('Deveria ter lançado erro de FK')
      } catch (e) {
        expect(e).toBeDefined()
      }
    })
  })

  describe('PATCH /api/persons/:id — Atualização via Prisma', () => {
    it('deve atualizar visualDescription de uma pessoa', async () => {
      const person = await prisma.dossierPerson.create({
        data: {
          dossierId,
          name: 'Jack Ruby',
          role: 'assassino do suspeito',
          relevance: 'secondary'
        }
      })

      const updated = await prisma.dossierPerson.update({
        where: { id: person.id },
        data: {
          visualDescription: 'Homem robusto, ~52 anos, cabelo escuro, expressão tensa, vestindo chapéu fedora e terno cinza'
        }
      })

      expect(updated.visualDescription).toContain('fedora')
      expect(updated.name).toBe('Jack Ruby') // campos intocados permanecem
    })

    it('deve atualizar relevância de mentioned para primary', async () => {
      const person = await prisma.dossierPerson.create({
        data: {
          dossierId,
          name: 'Abraham Zapruder',
          relevance: 'mentioned'
        }
      })

      const updated = await prisma.dossierPerson.update({
        where: { id: person.id },
        data: { relevance: 'primary' }
      })

      expect(updated.relevance).toBe('primary')
    })
  })

  describe('DELETE /api/persons/:id — Remoção via Prisma', () => {
    it('deve deletar uma pessoa com sucesso', async () => {
      const person = await prisma.dossierPerson.create({
        data: {
          dossierId,
          name: 'Pessoa Temporária',
          relevance: 'mentioned'
        }
      })

      await prisma.dossierPerson.delete({ where: { id: person.id } })

      const deleted = await prisma.dossierPerson.findUnique({ where: { id: person.id } })
      expect(deleted).toBeNull()
    })

    it('deve deletar em cascata ao remover o dossiê', async () => {
      await prisma.dossierPerson.create({
        data: { dossierId, name: 'Pessoa A', relevance: 'primary' }
      })
      await prisma.dossierPerson.create({
        data: { dossierId, name: 'Pessoa B', relevance: 'secondary' }
      })

      // Verificar que existem antes
      const before = await prisma.dossierPerson.findMany({ where: { dossierId } })
      expect(before.length).toBe(2)

      // Deletar dossiê
      await prisma.dossier.delete({ where: { id: dossierId } })

      // Verificar que foram deletadas em cascata
      const after = await prisma.dossierPerson.findMany({ where: { dossierId } })
      expect(after.length).toBe(0)
    })
  })

  describe('GET /api/dossiers/:id/persons — Listagem via Prisma', () => {
    it('deve listar pessoas ordenadas por relevância e order', async () => {
      await prisma.dossierPerson.create({
        data: { dossierId, name: 'Secundário', relevance: 'secondary', order: 0 }
      })
      await prisma.dossierPerson.create({
        data: { dossierId, name: 'Primário', relevance: 'primary', order: 0 }
      })
      await prisma.dossierPerson.create({
        data: { dossierId, name: 'Mencionado', relevance: 'mentioned', order: 0 }
      })

      const persons = await prisma.dossierPerson.findMany({
        where: { dossierId },
        orderBy: [{ relevance: 'asc' }, { order: 'asc' }]
      })

      expect(persons.length).toBe(3)
      // 'mentioned' < 'primary' < 'secondary' (alphabetical asc)
      // A ordenação por relevância asc é alfabética no Prisma
      expect(persons[0]!.name).toBe('Mencionado')
      expect(persons[1]!.name).toBe('Primário')
      expect(persons[2]!.name).toBe('Secundário')
    })
  })
})
