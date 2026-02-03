import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const connectionString = process.env.DATABASE_URL
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

const visualStyles = [
  {
    name: 'Epictok Imersivo',
    description: 'Estilo de ilustração 2D vintage, tipo Studio Ghibli e Eyvind Earle.',
    tags: 'digital 2D illustration, flat cell shading, inked outlines, vintage poster aesthetic, ligne claire style, Studio Ghibli background art, Eyvind Earle style, fantasy adventure concept art, classic RPG illustration, matte painting, textured paper effect, low detail faces, high contrast lighting, muted colors, earthy palette, desaturated tones, sepia undertones, dramatic sky lighting, backlit clouds, golden hour',
    order: 1,
    isActive: true
  },
  {
    name: 'Estilo GTA VI',
    description: 'Cores vibrantes, estética de Vice City com iluminação de pôr do sol.',
    tags: 'GTA 6 style, vibrant saturated colors, vice city sunset lighting, detailed urban environment, cinematic lens flare, high contrast, digital illustration, modern realistic graphics, neon highlights',
    order: 2,
    isActive: true
  },
  {
    name: 'Cyberpunk Futurista',
    description: 'Luzes neon, cidades futuristas e tecnologia avançada.',
    tags: 'cyberpunk aesthetic, neon city lights, rainy streets, futuristic technology, synthwave color palette, volumetric lighting, high tech low life, blade runner style',
    order: 3,
    isActive: true
  },
  {
    name: 'Pintura a Óleo',
    description: 'Estilo clássico de quadros antigos e museus.',
    tags: 'classical oil painting style, Renaissance art, visible brushstrokes, canvas texture, rich pigments, historical museum quality, Baroque influence',
    order: 4,
    isActive: true
  },
  {
    name: 'Fotorrealista',
    description: 'Imagens que parecem fotografias reais.',
    tags: 'photorealistic, 35mm photography, sharp focus, natural lighting, ultra-detailed, cinematic film still, Sony A7R IV, high resolution, raw photo',
    order: 5,
    isActive: true
  }
]

async function main() {
  console.log('🌱 Seeding visual styles...')

  await prisma.visualStyle.createMany({
    data: visualStyles,
    skipDuplicates: true
  })

  console.log(`✅ Created ${visualStyles.length} visual styles`)
  console.log('✨ Seed completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
