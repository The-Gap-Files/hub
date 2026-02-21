import 'dotenv/config'
import { prisma } from '../server/utils/prisma'

const highPerformingHooks = [
  {
    type: 'moral_confrontation',
    sourceType: 'viral_short',
    sourceTitle: 'Case religioso medieval - Teste A/B Real',
    genres: ['true-crime', 'historical', 'religious'],
    hookText: 'Você mataria uma criança em prol da sua religião?',
    duration: 'curto',
    emotionalTemperature: 'explosivo',
    tags: ['confronto direto', 'dilema moral', 'transgressão', 'pergunta impossível', 'você', 'implicação pessoal'],
    structuralPattern: 'Pergunta direta + Você + Tabu',
    structuralElements: ['confronto moral', 'implicação pessoal', 'tabu quebrado', 'impossível ignorar'],
    pacing: 'rápido',
    whyItWorks: 'Força o espectador a se posicionar moralmente em 2 segundos. O uso de "você" torna impossível scrollar sem responder mentalmente. Alta performance confirmada em testes A/B reais - superou hooks gerados automaticamente pelo projeto. A transgressão controlada (falar o indizível) para o scroll instantaneamente.'
  },
  {
    type: 'action_opening',
    sourceType: 'viral_short',
    sourceTitle: 'Serial killers sistemáticos - Teste A/B Real',
    genres: ['true-crime', 'psychological', 'horror'],
    hookText: 'Esses dois transformaram o esquartejamento humano em uma rotina de escritório tão banal quanto carimbar papéis.',
    duration: 'médio',
    emotionalTemperature: 'intrigante',
    tags: ['contraste absurdo', 'banalidade do mal', 'sistema', 'horror mundano', 'burocratização'],
    structuralPattern: 'Contraste violento (Horror + Mundano)',
    structuralElements: ['contraste cognitivo', 'banalização do horror', 'mecanismo sistêmico', 'metáfora corporativa'],
    pacing: 'moderado',
    whyItWorks: 'O cérebro não consegue reconciliar "esquartejamento" com "carimbar papéis" - cria tensão cognitiva irresistível. A metáfora corporativa neutraliza o gore e transforma em CONCEITO (banalidade do mal). Performance superior à média do projeto em testes reais. Atrai público cult/sofisticado.'
  },
  {
    type: 'action_opening',
    sourceType: 'viral_short',
    sourceTitle: 'Serial killers sistemáticos - Variante (baixa performance)',
    genres: ['true-crime', 'horror'],
    hookText: 'Esses dois homens processavam suas vítimas e colocavam em caixas de papelão.',
    duration: 'curto',
    emotionalTemperature: 'tenso',
    tags: ['gore implícito', 'sintoma', 'violência física'],
    structuralPattern: 'Descrição de ato físico',
    structuralElements: ['violência explícita', 'foco em sintoma', 'repulsa'],
    pacing: 'rápido',
    whyItWorks: 'NÃO FUNCIONA BEM: Focado no sintoma (ato físico) em vez do mecanismo. Causa REPULSA em vez de curiosidade. Dados reais mostram performance inferior aos hooks que focam no sistema/processo. Mantido na base como contra-exemplo (o que NÃO fazer).',
    isActive: false // Desativado como contra-exemplo
  }
]

async function main() {
  console.log('🔥 Adicionando hooks de alta performance (dados reais)...\n')

  for (const hook of highPerformingHooks) {
    const created = await prisma.narrativeHook.create({
      data: hook
    })
    console.log(`${hook.isActive !== false ? '✅' : '⚠️'} Criado: ${created.sourceTitle}`)
    console.log(`   Tipo: ${created.type}`)
    console.log(`   Performance: ${hook.isActive !== false ? 'ALTA (ativo)' : 'BAIXA (contra-exemplo)'}\n`)
  }

  console.log('✨ Hooks baseados em dados reais adicionados!')
  console.log('\n📊 INSIGHT: Hooks com "transgressão controlada" e "contraste absurdo"')
  console.log('   superam hooks "seguros" em testes A/B reais.')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
