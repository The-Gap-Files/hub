/**
 * Plugin de inicialização do banco de dados
 * 
 * Este plugin roda automaticamente ao iniciar o servidor Nitro.
 * Garante que os dados essenciais existam no banco de dados.
 */

import { prisma } from '../utils/prisma'

const VISUAL_STYLES = [
  {
    id: 'epictok',
    name: 'Epictok Imersivo',
    description: 'Estilo de ilustração 2D vintage, tipo Studio Ghibli e Eyvind Earle.',
    baseStyle: 'Cinematic 2D illustration, Studio Ghibli background art style, Eyvind Earle inspired',
    lightingTags: 'warm golden hour light, soft volumetric rays filtering through clouds, dramatic backlighting, muted warm tones',
    atmosphereTags: 'dreamlike, nostalgic, epic adventure, serene yet mysterious',
    compositionTags: 'wide establishing shot, low angle emphasizing vastness, textured paper effect',
    tags: 'flat cell shading, inked outlines, vintage poster aesthetic, ligne claire style, fantasy adventure concept art, classic RPG illustration, matte painting, low detail faces, high contrast lighting, earthy palette, desaturated tones, sepia undertones',
    order: 1,
    isActive: true
  },
  {
    id: 'gta6',
    name: 'GTA 6 Vibes',
    description: 'Estilo vibrante com cores saturadas e iluminação de Miami.',
    baseStyle: 'Cinematic photorealistic, modern AAA game aesthetic, GTA VI style',
    lightingTags: 'vibrant Miami sunset, neon lights reflecting on wet surfaces, warm tropical golden hour',
    atmosphereTags: 'energetic, luxurious, urban tropical paradise, high-octane',
    compositionTags: 'dynamic camera movement, establishing wide shots of cityscape, low angle hero shots',
    tags: 'saturated colors, photorealistic, neon lights, urban, tropical, palm trees swaying, ocean view, luxury cars gleaming, modern architecture',
    order: 2,
    isActive: true
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Estilo futurista com neon, chuva e tecnologia avançada.',
    baseStyle: 'Cinematic cyberpunk, Blade Runner inspired, dark sci-fi',
    lightingTags: 'neon lights cutting through rain, volumetric fog with colorful reflections, dramatic chiaroscuro',
    atmosphereTags: 'dystopian, mysterious, tech-noir, rain-soaked melancholy',
    compositionTags: 'low angle looking up at megastructures, rain droplets on camera lens, holographic displays floating',
    tags: 'futuristic, advanced technology, dark atmosphere, sci-fi, holographic displays, flying cars passing by, megacity',
    order: 3,
    isActive: true
  },
  {
    id: 'oil-painting',
    name: 'Pintura a Óleo',
    description: 'Estilo de pintura a óleo clássica com pinceladas visíveis.',
    baseStyle: 'Classic oil painting, renaissance and baroque style, museum quality',
    lightingTags: 'soft natural window light, chiaroscuro dramatic shadows, warm candlelight glow',
    atmosphereTags: 'timeless, contemplative, classical elegance, artistic reverence',
    compositionTags: 'traditional portrait framing, close-up with shallow depth, painterly brush strokes visible',
    tags: 'visible brush strokes, canvas texture, impressionist touches, artistic, painterly, traditional art',
    order: 4,
    isActive: true
  },
  {
    id: 'photorealistic',
    name: 'Fotorrealista',
    description: 'Estilo fotorrealista como fotografia de cinema em alta resolução.',
    baseStyle: 'Cinematic photorealistic, ARRI Alexa 65mm, professional cinema camera',
    lightingTags: 'natural realistic lighting, soft bokeh in background, film grain texture, depth of field',
    atmosphereTags: 'authentic, immersive, documentary realism, cinematic presence',
    compositionTags: 'shallow depth of field, cinematic aspect ratio, professional framing',
    tags: 'ultra detailed, realistic lighting, 4K, 8K, DSLR quality, professional camera work',
    order: 5,
    isActive: true
  }
]

const SCRIPT_STYLES = [
  {
    id: 'documentary',
    name: 'Documentário Investigativo',
    description: 'Estilo documental sério e investigativo, focado em fatos e evidências com voz autoritária.',
    instructions: 'Adote um tom documental sério e investigativo, com uma voz autoritária no estilo de "jornalismo gonzo". Priorize fatos duros entremeados com especulações instigantes. Use frases curtas e diretas. Mantenha o ritmo rápido.',
    order: 1,
    isActive: true
  },
  {
    id: 'mystery',
    name: 'Mistério Suspense',
    description: 'Estilo misterioso com tensão crescente, pausas dramáticas e sussurros teóricos.',
    instructions: 'Crie tensão constante com pausas dramáticas e sussurros teóricos. Use revelações graduais e termine cenas com perguntas implícitas. Mantenha o espectador em desequilíbrio informativo. Foco em mistério e sensação de "segredo proibido".',
    order: 2,
    isActive: true
  },
  {
    id: 'epic',
    name: 'Épico Filosófico',
    description: 'Estilo grandioso e questionador, conectando eventos históricos a reflexões sobre a realidade.',
    instructions: 'Seja grandioso, questionador da realidade e profundo. Conecte eventos passados a implicações filosóficas e existenciais. Use um tom de "revelação cósmica". Eleve o tema histórico a uma dimensão épica e atemporal.',
    order: 3,
    isActive: true
  },
  {
    id: 'narrative',
    name: 'Narrativo Imersivo',
    description: 'Estilo de narrativa envolvente com arco dramático claro e foco em storytelling emocional.',
    instructions: 'Conte uma história envolvente com arco narrativo claro (Gancho → Desenvolvimento → Clímax → Resolução). Alterne entre fatos e emoções humanas. Use descrições sensoriais (cheiros, texturas, temperatura) para criar imersão total.',
    order: 4,
    isActive: true
  }
]

async function initializeVisualStyles() {
  try {
    console.log('🎨 Verificando estilos visuais...')

    let created = 0
    let existing = 0

    for (const style of VISUAL_STYLES) {
      const result = await prisma.visualStyle.upsert({
        where: { id: style.id },
        create: style,
        update: {} // Não atualiza se já existir
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
        update: {} // Não atualiza se já existir
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
