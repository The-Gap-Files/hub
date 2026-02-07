#!/usr/bin/env tsx
/**
 * Script de inicialização manual do banco de dados
 * 
 * NOTA: VisualStyles e ScriptStyles foram migrados para constantes.
 * Não há necessidade de seeding desses dados no banco.
 * 
 * Se houver novas entidades que precisam de seeding,
 * adicione aqui.
 * 
 * Uso:
 *   npm run db:init
 *   ou
 *   npx tsx scripts/init-db.ts
 */

import 'dotenv/config'
import { prisma } from '../server/utils/prisma'

async function main() {
  console.log('🚀 Inicializando banco de dados...\n')
  console.log('ℹ️  VisualStyles e ScriptStyles agora são constantes (não mais tabelas).')
  console.log('ℹ️  Ver: server/constants/visual-styles.ts e server/constants/script-styles.ts')
  console.log('\n✨ Nenhum seeding necessário.')
}

main()
  .catch((e) => {
    console.error('❌ Erro fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
