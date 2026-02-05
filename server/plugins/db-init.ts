/**
 * Plugin de inicialização do banco de dados
 * 
 * Este plugin roda automaticamente ao iniciar o servidor Nitro.
 * Garante que os dados essenciais existam no banco de dados.
 */

import { SCRIPT_STYLES, VISUAL_STYLES } from '../utils/constants'
import { prisma } from '../utils/prisma'

async function initializeVisualStyles() {
  try {
    console.log('🎨 Verificando estilos visuais...')

    let created = 0
    let existing = 0

    for (const style of VISUAL_STYLES) {
      const result = await prisma.visualStyle.upsert({
        where: { id: style.id },
        create: style,
        update: style // Atualiza para aplicar as novas definições
      })

      // Verifica se foi criado agora (createdAt recente - últimos 2 segundos)
      const isNew = new Date(result.createdAt).getTime() > Date.now() - 2000
      if (isNew) created++
      else existing++
    }

    if (created > 0) {
      console.log(`✅ ${created} estilos visuais criados`)
    }
    if (existing > 0) {
      console.log(`✓ ${existing} estilos visuais já existiam`)
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar estilos visuais:', error)
  }
}

async function initializeScriptStyles() {
  try {
    console.log('📝 Verificando estilos de roteiro...')

    let created = 0
    let existing = 0

    for (const style of SCRIPT_STYLES) {
      const result = await prisma.scriptStyle.upsert({
        where: { id: style.id },
        create: style,
        update: style // Atualiza para aplicar as novas Bíblias de Estilo
      })

      // Verifica se foi criado agora (createdAt recente - últimos 2 segundos)
      const isNew = new Date(result.createdAt).getTime() > Date.now() - 2000
      if (isNew) created++
      else existing++
    }

    if (created > 0) {
      console.log(`✅ ${created} estilos de roteiro criados`)
    }
    if (existing > 0) {
      console.log(`✓ ${existing} estilos de roteiro já existiam`)
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar estilos de roteiro:', error)
  }
}

export default defineNitroPlugin(async (nitroApp) => {
  console.log('🚀 Inicializando banco de dados...')

  await initializeVisualStyles()
  await initializeScriptStyles()

  console.log('✨ Inicialização concluída!')
})
