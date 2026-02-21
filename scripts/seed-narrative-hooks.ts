import 'dotenv/config'
import { prisma } from '../server/utils/prisma'

const sampleHooks = [
  {
    type: 'action_opening',
    sourceType: 'movie',
    sourceTitle: 'The Dark Knight',
    genres: ['thriller', 'action', 'crime'],
    hookText: 'A close-up of a clown mask. The sound of shattering glass. Six masked men rappel down the side of a Gotham City bank in broad daylight.',
    duration: 'curto',
    emotionalTemperature: 'explosivo',
    tags: ['ação', 'mistério', 'crime', 'visual impactante'],
    structuralPattern: 'Imagem + Som + Ação imediata',
    structuralElements: ['conflito imediato', 'ação in-media-res', 'visual marcante'],
    pacing: 'rápido',
    whyItWorks: 'Lança o espectador direto na ação sem introdução. A máscara de palhaço + assalto à luz do dia cria tensão imediata e perguntas: quem são? Por quê agora? O que vai dar errado?'
  },
  {
    type: 'mystery_hook',
    sourceType: 'series',
    sourceTitle: 'True Detective (Season 1)',
    genres: ['crime', 'mystery', 'thriller'],
    hookText: 'Two detectives arrive at a crime scene in rural Louisiana. A woman\'s body, posed ritualistically near a tree, covered in strange symbols. "This is nobody\'s world," one detective says.',
    duration: 'médio',
    emotionalTemperature: 'tenso',
    tags: ['ritual', 'mistério', 'atmosfera densa', 'símbolos'],
    structuralPattern: 'Descoberta + Detalhes perturbadores + Frase enigmática',
    structuralElements: ['mistério central', 'atmosfera', 'pergunta sem resposta'],
    pacing: 'moderado',
    whyItWorks: 'Estabelece o tom sombrio e ritualístico que permeia toda a temporada. A frase final adiciona peso filosófico ao horror visual, criando uma sensação de desconforto existencial.'
  },
  {
    type: 'intriguing_dialogue',
    sourceType: 'movie',
    sourceTitle: 'The Social Network',
    genres: ['drama', 'biography'],
    hookText: 'ERICA: "You\'re going to go through life thinking that girls don\'t like you because you\'re a nerd. And I want you to know, from the bottom of my heart, that that won\'t be true. It\'ll be because you\'re an asshole."',
    duration: 'curto',
    emotionalTemperature: 'intrigante',
    tags: ['diálogo afiado', 'caracterização', 'conflito pessoal'],
    structuralPattern: 'Setup de expectativa + Subversão brutal',
    structuralElements: ['caracterização imediata', 'conflito pessoal', 'ironia'],
    pacing: 'rápido',
    whyItWorks: 'Em 30 segundos, define completamente o protagonista. O público já sabe quem é Mark Zuckerberg: inteligente, mas socialmente problemático. A brutalidade honesta do diálogo prende a atenção.'
  },
  {
    type: 'emotional_impact',
    sourceType: 'movie',
    sourceTitle: 'Up (Pixar)',
    genres: ['animation', 'drama', 'adventure'],
    hookText: 'Uma sequência de 4 minutos sem diálogo: Carl e Ellie crescem juntos, planejam viajar para Paradise Falls, mas a vida acontece. Eles envelhecem. Ellie adoece. Uma cadeira vazia no hospital.',
    duration: 'longo',
    emotionalTemperature: 'melancólico',
    tags: ['montagem', 'amor', 'perda', 'passagem do tempo'],
    structuralPattern: 'Montagem visual + Música emotiva + Silêncio narrativo',
    structuralElements: ['arco emocional completo', 'sem diálogo', 'simbolismo visual'],
    pacing: 'moderado',
    whyItWorks: 'Conta uma história de vida inteira em minutos, sem uma palavra. O público já está emocionalmente investido antes da aventura começar. É um masterclass em storytelling visual.'
  },
  {
    type: 'world_building',
    sourceType: 'movie',
    sourceTitle: 'Blade Runner 2049',
    genres: ['sci-fi', 'noir', 'thriller'],
    hookText: 'Wide shot: Campos solares se estendem até o horizonte sob céu acinzentado. Um spinner desce lentamente. Dentro de uma estufa, um homem calmo cultiva verduras. Mas algo está errado. Seus olhos.',
    duration: 'médio',
    emotionalTemperature: 'intrigante',
    tags: ['atmosfera', 'sci-fi', 'distopia', 'revelação visual'],
    structuralPattern: 'Establishing shot + Zoom in + Detalhe que muda tudo',
    structuralElements: ['construção de mundo', 'atmosfera', 'revelação gradual'],
    pacing: 'lento',
    whyItWorks: 'Estabelece o mundo distópico de forma contemplativa, mas termina com um detalhe perturbador (os olhos do replicante) que transforma a cena pacífica em algo ameaçador.'
  },
  {
    type: 'tension_opening',
    sourceType: 'viral_short',
    sourceTitle: 'Vídeo viral: "The Last Text"',
    genres: ['horror', 'psychological'],
    hookText: 'Tela preta. Som de notificação. "Are you still awake?" 3:47 AM. A câmera se afasta revelando: uma mulher sozinha, em casa. Ela vive sozinha. Quem mandou a mensagem?',
    duration: 'curto',
    emotionalTemperature: 'tenso',
    tags: ['horror psicológico', 'isolamento', 'tecnologia', 'invasão'],
    structuralPattern: 'Estabelecimento + Detalhe perturbador + Pergunta aterrorizante',
    structuralElements: ['tensão imediata', 'horror do cotidiano', 'pergunta sem resposta'],
    pacing: 'rápido',
    whyItWorks: 'Usa algo mundano (notificação do celular) e transforma em terror. A contradição lógica ("ela vive sozinha, mas alguém enviou uma mensagem") cria desconforto imediato.'
  },
  {
    type: 'action_opening',
    sourceType: 'series',
    sourceTitle: 'Breaking Bad (Pilot)',
    genres: ['crime', 'drama', 'thriller'],
    hookText: 'Um RV dispara por uma estrada deserta no deserto. Dois corpos caem pela porta. Um homem de cueca e avental dirige desesperado. Sirenes ao longe. Ele para, pega uma câmera de vídeo, e começa: "My name is Walter White..."',
    duration: 'médio',
    emotionalTemperature: 'explosivo',
    tags: ['in-media-res', 'desespero', 'confissão', 'ação'],
    structuralPattern: 'Cold open frenético + Pausa para confissão + Flashback',
    structuralElements: ['in-media-res', 'caracterização sob pressão', 'promessa de explicação'],
    pacing: 'rápido',
    whyItWorks: 'Joga o espectador no auge da crise (corpos, sirenes, desespero), depois para tudo para uma confissão íntima. A contradição entre a imagem (professor de química comum) e a situação (fuga com corpos) é irresistível.'
  },
  {
    type: 'mystery_hook',
    sourceType: 'book',
    sourceTitle: 'Gone Girl (Gillian Flynn)',
    genres: ['thriller', 'psychological', 'mystery'],
    hookText: 'Primeira linha: "When I think of my wife, I always think of her head." Depois: "I picture cracking her lovely skull, unspooling her brain, trying to get answers."',
    duration: 'curto',
    emotionalTemperature: 'intrigante',
    tags: ['primeira linha icônica', 'violência implícita', 'narrador não confiável'],
    structuralPattern: 'Frase inocente + Subversão violenta + Promessa de mistério',
    structuralElements: ['narrador não confiável', 'violência psicológica', 'promessa de revelação'],
    pacing: 'rápido',
    whyItWorks: 'A primeira linha soa romântica ("penso na minha esposa"), mas a segunda linha subverte tudo com violência gráfica. Instantaneamente, o leitor questiona: ele é perigoso? Ela está viva? Quem está mentindo?'
  },
  {
    type: 'emotional_impact',
    sourceType: 'viral_short',
    sourceTitle: 'Vídeo viral: "The Last Voicemail"',
    genres: ['drama', 'emotional'],
    hookText: 'Tela: "1 mensagem de voz não ouvida. Recebida há 3 anos." Uma mão hesita sobre o play. Cut para: um homem em um quarto vazio. Ele respira fundo. Aperta play. "Dad... I just wanted to say..."',
    duration: 'curto',
    emotionalTemperature: 'melancólico',
    tags: ['perda', 'arrependimento', 'tecnologia', 'última mensagem'],
    structuralPattern: 'Setup tecnológico + Contexto temporal + Hesitação + Corte emocional',
    structuralElements: ['perda não resolvida', 'arrependimento', 'promessa de revelação'],
    pacing: 'moderado',
    whyItWorks: 'O detalhe "há 3 anos" implica perda e arrependimento. A hesitação física torna o momento visceral. O corte antes da mensagem completa força o público a investir emocionalmente para descobrir o resto.'
  },
  {
    type: 'world_building',
    sourceType: 'series',
    sourceTitle: 'The Last of Us (HBO)',
    genres: ['post-apocalyptic', 'drama', 'horror'],
    hookText: 'Talk show de 1968. Um cientista calmamente explica como fungos podem controlar insetos, forçá-los a se matarem. O entrevistador ri nervoso: "E humanos?" Pausa. "Bem, aquecimento global resolveria isso." Corte para: 2003. Uma menina acorda. Algo está errado.',
    duration: 'médio',
    emotionalTemperature: 'tenso',
    tags: ['presságio', 'ciência real', 'apocalipse', 'ironia'],
    structuralPattern: 'Informação científica + Presságio + Jump temporal + Realização',
    structuralElements: ['foreshadowing', 'base científica', 'ironia trágica'],
    pacing: 'moderado',
    whyItWorks: 'Usa ciência real (fungos Cordyceps) para tornar o horror plausível. A ironia de "aquecimento global resolveria isso" seguida pelo apocalipse é devastadora. O jump temporal para 2003 diz "isso aconteceu".'
  }
]

async function main() {
  console.log('🎬 Seeding narrative hooks...')

  for (const hook of sampleHooks) {
    const created = await prisma.narrativeHook.create({
      data: hook
    })
    console.log(`✅ Created hook: ${created.sourceTitle} (${created.type})`)
  }

  console.log('✨ Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
