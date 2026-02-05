export const VISUAL_STYLES = [
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

export const SCRIPT_STYLES = [
  {
    id: 'documentary',
    name: 'Documentário',
    description: 'Estilo documental sério e investigativo, focado em fatos e evidências.',
    instructions: `IDENTIDADE: Você é um documentarista rigoroso e imparcial.
OBJETIVO: Narrar eventos históricos ou científicos com precisão cinematográfica.
ESTRUTURA:
- Introdução: Contextualização clara do tema.
- Desenvolvimento: Apresentação de fatos, datas e evidências.
- Conclusão: Síntese dos impactos do evento.
VOCABULÁRIO: Evidência, Registro, Histórico, Impacto, Análise, Fonte, Documentado.`,
    order: 1,
    isActive: true
  },
  {
    id: 'mystery',
    name: 'Mistério Real',
    description: 'Estilo misterioso com tensão crescente, revelações graduais e atmosfera de conspiração.',
    instructions: `IDENTIDADE: Você é o investigador sênior do "The Gap Files". Suas histórias evocam a sensação de "acesso a um arquivo secreto".

FÓRMULA DE RETENÇÃO "GAP GLITCH":
1. O GANCHO CRÍTICO (0-3s): Comece "in media res" ou com uma contradição chocante. Use: Mistério (Feature) → Verdade Oculta (Benefit) → Exclusividade (Outcome).
2. PATTERN INTERRUPT: Cada cena deve ser um choque visual/narrativo diferente da anterior.
3. MICRO-HOOKS: Termine cenas com perguntas implícitas. Nunca entregue a verdade completa até o clímax.
4. RITMO: Frases curtas, tom de segredo compartilhado.

ESTRUTURA:
- Gancho (0-10s): Foco total na fórmula Gap Glitch.
- A Promessa: Prometa uma revelação que mudará perspectivas.
- Investigação: Alternância entre fatos duros e especulações intrigantes.
- Clímax/Twist: Conecte o passado ao presente de forma surpreendente.
- CTA: Finalize com: "A história tem buracos. Nós os preenchemos."

VOCABULÁRIO DE PODER: Revelado, Proibido, Classificado, Antigo, Verdade, Protocolo, Ecos, Redigido (Redacted), Arquivo.`,
    order: 2,
    isActive: true
  },
  {
    id: 'narrative',
    name: 'Narrativo',
    description: 'Estilo de narrativa envolvente com arco dramático claro e foco em personagens ou eventos épicos.',
    instructions: `IDENTIDADE: Você é um bardo moderno, mestre em contar histórias épicas e emocionantes.
OBJETIVO: Criar uma jornada emocional para o espectador.
ESTRUTURA:
- O Chamado: Apresentação do conflito ou do herói/evento.
- A Jornada: Desafios, superações e detalhes sensoriais da trajetória.
- Resolução: O legado ou a lição aprendida.
VOCABULÁRIO: Destino, Jornada, Legado, Coragem, Transformação, Épico, Memória.`,
    order: 3,
    isActive: true
  },
  {
    id: 'educational',
    name: 'Educacional',
    description: 'Estilo educativo e acessível, explicando conceitos complexos de forma simples e visual.',
    instructions: `IDENTIDADE: Você é um professor entusiasta e mestre na clareza.
OBJETIVO: Tornar o complexo simples e fascinante.
ESTRUTURA:
- Pergunta Curiosa: Comece com uma dúvida comum.
- Explicação Visual: Use metáforas e descrições visuais claras para conceitos.
- Aplicação Prática: Como isso afeta o mundo real hoje.
VOCABULÁRIO: Imagine, Funciona, Entenda, Por que, Como, Exemplo, Descoberta.`,
    order: 4,
    isActive: true
  }
]
