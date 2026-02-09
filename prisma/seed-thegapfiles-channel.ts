/**
 * Seed Script: Cria o canal "The Gap Files" e vincula todos os dossiers existentes sem canal.
 * 
 * Executar com: npx tsx prisma/seed-thegapfiles-channel.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import 'dotenv/config'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('📁 The Gap Files — Seed: Canal The Gap Files\n')

  // 1. Verificar se o canal já existe
  const existing = await prisma.channel.findUnique({
    where: { handle: '@thegapfiles' }
  })

  if (existing) {
    console.log(`✅ Canal já existe: "${existing.name}" (${existing.handle})`)
    console.log(`   ID: ${existing.id}`)
  } else {
    // 2. Criar o canal
    const channel = await prisma.channel.create({
      data: {
        name: 'The Gap Files',
        handle: '@thegapfiles',
        description: 'Mistérios, conspirações e eventos inexplicáveis que a história não conseguiu explicar. O que aconteceu nos intervalos que ninguém viu?',
        platform: 'YOUTUBE',
        defaultVisualStyleId: 'ghibli-dark',
        defaultScriptStyleId: 'mystery',
        isActive: true
      }
    })
    console.log(`✅ Canal criado: "${channel.name}" (${channel.handle})`)
    console.log(`   ID: ${channel.id}`)
  }

  // 3. Buscar o canal (pode ter sido criado agora ou já existir)
  const channel = await prisma.channel.findUnique({
    where: { handle: '@thegapfiles' }
  })

  if (!channel) {
    console.error('❌ Erro: Canal não encontrado após criação')
    return
  }

  // 4. Vincular dossiers sem canal
  const orphanDossiers = await prisma.dossier.count({
    where: { channelId: null }
  })

  if (orphanDossiers === 0) {
    console.log('\n✅ Nenhum dossier sem canal encontrado.')
  } else {
    const result = await prisma.dossier.updateMany({
      where: { channelId: null },
      data: { channelId: channel.id }
    })
    console.log(`\n✅ ${result.count} dossier(s) vinculado(s) ao canal "${channel.name}"`)
  }

  // 5. Resumo final
  const totalDossiers = await prisma.dossier.count({
    where: { channelId: channel.id }
  })
  console.log(`\n📊 Total de dossiers no canal: ${totalDossiers}`)
  console.log('\n🎉 Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
