#!/usr/bin/env tsx
/**
 * Script de inicialização manual do banco de dados
 * 
 * Uso:
 *   npm run db:init
 *   ou
 *   npx tsx scripts/init-db.ts
 */

import 'dotenv/config'
import { VISUAL_STYLES, SCRIPT_STYLES } from '../server/utils/constants'
import { prisma } from '../server/utils/prisma'

async function initializeVisualStyles() {
  console.log('🎨 Verificando estilos visuais...')

  let created = 0
  let existing = 0

  for (const style of VISUAL_STYLES) {
    const result = await prisma.visualStyle.upsert({
      where: { id: style.id },
      create: style,
      update: style // Atualiza para aplicar as novas definições
    })

    const isNew = new Date(result.createdAt).getTime() > Date.now() - 2000
    if (isNew) created++
    else existing++
  }

  console.log(`✅ ${created} estilos visuais criados${existing > 0 ? ` (${existing} já existiam/atualizados)` : ''}`)
}

async function initializeScriptStyles() {
  console.log('📝 Verificando estilos de roteiro...')

  let created = 0
  let existing = 0

  for (const style of SCRIPT_STYLES) {
    const result = await prisma.scriptStyle.upsert({
      where: { id: style.id },
      create: style,
      update: style // Atualiza para aplicar as novas Bíblias de Estilo
    })

    const isNew = new Date(result.createdAt).getTime() > Date.now() - 2000
    if (isNew) created++
    else existing++
  }

  console.log(`✅ ${created} estilos de roteiro criados${existing > 0 ? ` (${existing} já existiam/atualizados)` : ''}`)
}

async function main() {
  console.log('🚀 Inicializando banco de dados...\n')

  try {
    await initializeVisualStyles()
    await initializeScriptStyles()

    console.log('\n✨ Inicialização concluída com sucesso!')
  } catch (error) {
    console.error('\n❌ Erro durante inicialização:', error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
