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
import { PrismaClient } from '@prisma/client'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const VISUAL_STYLES = [
  {
    id: 'epictok',
    name: 'Epictok Imersivo',
    description: 'Estilo de ilustração 2D vintage, tipo Studio Ghibli e Eyvind Earle.',
    tags: 'digital 2D illustration, flat cell shading, inked outlines, vintage poster aesthetic, ligne claire style, Studio Ghibli background art, Eyvind Earle style, fantasy adventure concept art, classic RPG illustration, matte painting, textured paper effect, low detail faces, high contrast lighting, muted colors, earthy palette, desaturated tones, sepia undertones, dramatic sky lighting, backlit clouds, golden hour',
    order: 1,
    isActive: true
  },
  {
    id: 'gta6',
    name: 'GTA 6 Vibes',
    description: 'Estilo vibrante com cores saturadas e iluminação de Miami.',
    tags: 'vibrant colors, saturated, Miami sunset lighting, modern high-budget game aesthetic, photorealistic, cinematic, neon lights, urban, tropical, palm trees, ocean view, luxury cars, modern architecture',
    order: 2,
    isActive: true
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Estilo futurista com neon, chuva e tecnologia avançada.',
    tags: 'cyberpunk, neon, futuristic, rain, colorful lights, advanced technology, dark atmosphere, blade runner style, sci-fi, dystopian, holographic displays, flying cars, megacity',
    order: 3,
    isActive: true
  },
  {
    id: 'oil-painting',
    name: 'Pintura a Óleo',
    description: 'Estilo de pintura a óleo clássica com pinceladas visíveis.',
    tags: 'oil painting, classic art style, visible brush strokes, canvas texture, renaissance style, baroque, impressionist, artistic, painterly, traditional art, museum quality',
    order: 4,
    isActive: true
  },
  {
    id: 'photorealistic',
    name: 'Fotorrealista',
    description: 'Estilo fotorrealista como fotografia de cinema em alta resolução.',
    tags: 'photorealistic, cinematic photography, high resolution, DSLR, professional camera, 4K, 8K, ultra detailed, realistic lighting, depth of field, bokeh, film grain',
    order: 5,
    isActive: true
  }
]

const SCRIPT_STYLES = [
  {
    id: 'documentary',
    name: 'Documentário',
    description: 'Estilo documental sério e investigativo, focado em fatos e evidências.',
    instructions: 'Adote um tom documental sério e investigativo.',
    order: 1,
    isActive: true
  },
  {
    id: 'mystery',
    name: 'Mistério',
    description: 'Estilo misterioso com tensão crescente e revelações graduais.',
    instructions: 'Crie tensão e mistério, com revelações graduais.',
    order: 2,
    isActive: true
  },
  {
    id: 'narrative',
    name: 'Narrativo',
    description: 'Estilo de narrativa envolvente com arco dramático claro.',
    instructions: 'Conte uma história envolvente com arco narrativo claro.',
    order: 3,
    isActive: true
  },
  {
    id: 'educational',
    name: 'Educacional',
    description: 'Estilo educativo e acessível, explicando conceitos complexos de forma simples.',
    instructions: 'Seja informativo mas acessível, explicando conceitos complexos.',
    order: 4,
    isActive: true
  }
]

async function initializeVisualStyles() {
  console.log('🎨 Verificando estilos visuais...')

  let created = 0
  let existing = 0

  for (const style of VISUAL_STYLES) {
    const result = await prisma.visualStyle.upsert({
      where: { id: style.id },
      create: style,
      update: {}
    })

    const isNew = new Date(result.createdAt).getTime() > Date.now() - 2000
    if (isNew) created++
    else existing++
  }

  console.log(`✅ ${created} estilos visuais criados${existing > 0 ? ` (${existing} já existiam)` : ''}`)
}

async function initializeScriptStyles() {
  console.log('📝 Verificando estilos de roteiro...')

  let created = 0
  let existing = 0

  for (const style of SCRIPT_STYLES) {
    const result = await prisma.scriptStyle.upsert({
      where: { id: style.id },
      create: style,
      update: {}
    })

    const isNew = new Date(result.createdAt).getTime() > Date.now() - 2000
    if (isNew) created++
    else existing++
  }

  console.log(`✅ ${created} estilos de roteiro criados${existing > 0 ? ` (${existing} já existiam)` : ''}`)
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
    await pool.end()
  })
