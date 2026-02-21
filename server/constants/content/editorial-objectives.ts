/**
 * Objetivos Editoriais Predefinidos
 * 
 * Diretrizes narrativas que governam a geração do roteiro.
 * O usuário pode escolher um preset ou escrever seu próprio objetivo.
 */

export interface EditorialObjective {
  id: string
  name: string
  description: string
  instruction: string // O texto que vai direto pro prompt da LLM
  category: 'reveal' | 'suspense' | 'educational' | 'emotional' | 'viral'
  icon: string // Nome do ícone Lucide
}

export const EDITORIAL_OBJECTIVES: EditorialObjective[] = [
  // === REVELAÇÃO ===
  {
    id: 'full-reveal',
    name: 'Revelação Total',
    description: 'Expõe toda a verdade de forma direta e impactante',
    instruction: 'Revele TODA a verdade do assunto de forma direta, sem rodeios. O espectador deve terminar o vídeo sabendo absolutamente tudo. Use provas, dados e fatos concretos para construir uma narrativa reveladora que não deixa dúvidas.',
    category: 'reveal',
    icon: 'Eye'
  },
  {
    id: 'hidden-truth',
    name: 'Verdade Oculta',
    description: 'Revela o que a narrativa oficial esconde',
    instruction: 'Foque no que NÃO está sendo dito. Desmonte a narrativa oficial ponto a ponto, revelando as camadas ocultas. Crie a sensação de que o espectador está descobrindo algo que poucos sabem. Use contrapontos entre o discurso público e a realidade.',
    category: 'reveal',
    icon: 'EyeOff'
  },

  // === SUSPENSE ===
  {
    id: 'cliffhanger',
    name: 'Cliffhanger Estratégico',
    description: 'Esconde a verdade e deixa o espectador querendo mais',
    instruction: 'NÃO revele toda a verdade. Construa tensão crescente, dê pistas, levante perguntas perturbadoras, mas ESCONDA o desfecho. O espectador DEVE terminar o vídeo com a sensação irresistível de que precisa ver o próximo. Use frases como "mas o que aconteceu depois mudou tudo" sem revelar o quê.',
    category: 'suspense',
    icon: 'Clock'
  },
  {
    id: 'mystery-layers',
    name: 'Camadas de Mistério',
    description: 'Revela parcialmente, criando mais perguntas que respostas',
    instruction: 'Adote uma abordagem de mistério em camadas. Cada revelação parcial deve gerar MAIS perguntas do que respostas. O espectador sai do vídeo com 3-4 perguntas não respondidas. Crie a sensação de que há algo muito maior por trás do que foi mostrado.',
    category: 'suspense',
    icon: 'Layers'
  },

  // === EDUCACIONAL ===
  {
    id: 'deep-analysis',
    name: 'Análise Profunda',
    description: 'Explica o tema com profundidade e contexto histórico',
    instruction: 'Adote um tom analítico e educacional. Conecte o tema ao contexto histórico, econômico ou social. O espectador deve sair sentindo que compreende o assunto em profundidade, não apenas superficialmente. Use dados, cronologia e comparações para construir entendimento.',
    category: 'educational',
    icon: 'BookOpen'
  },
  {
    id: 'explainer',
    name: 'Explainer Didático',
    description: 'Simplifica o complexo de forma acessível e envolvente',
    instruction: 'Explique o tema como se estivesse contando para alguém inteligente que nunca ouviu falar do assunto. Simplifique sem emburrecer. Use analogias, exemplos concretos e uma progressão lógica que torna o complexo acessível. Priorize clareza sobre dramaticidade.',
    category: 'educational',
    icon: 'GraduationCap'
  },

  // === EMOCIONAL ===
  {
    id: 'emotional-impact',
    name: 'Impacto Emocional',
    description: 'Prioriza a conexão emocional acima de tudo',
    instruction: 'Construa uma narrativa que priorize a EMOÇÃO acima de tudo. Foque nas histórias humanas por trás dos fatos. Use detalhes sensoriais, momentos de silêncio dramático e arcos emocionais que fazem o espectador sentir — não apenas entender. O objetivo é que o vídeo fique marcado na memória.',
    category: 'emotional',
    icon: 'Heart'
  },

  // === VIRAL ===
  {
    id: 'viral-hook',
    name: 'Gancho Viral',
    description: 'Otimizado para máxima retenção e compartilhamento',
    instruction: 'Otimize para RETENÇÃO e COMPARTILHAMENTO. Comece com um gancho nos primeiros 3 segundos que torna impossível sair. Use padrões de interrupção a cada 15-20 segundos. Inclua pelo menos 3 momentos "isso não pode ser verdade" que fazem o espectador querer compartilhar. Termine com uma afirmação provocativa que gera debate nos comentários.',
    category: 'viral',
    icon: 'Flame'
  },
  {
    id: 'controversy',
    name: 'Polêmica Controlada',
    description: 'Apresenta o tema de forma polarizante mas fundamentada',
    instruction: 'Apresente o tema de forma POLARIZANTE mas fundamentada. Escolha um lado e defenda com vigor, usando dados e argumentos fortes. Não seja neutro — tome posição. O objetivo é gerar debate e engajamento. Mas mantenha a credibilidade: toda afirmação deve ter fundamento.',
    category: 'viral',
    icon: 'Swords'
  }
]

export function getEditorialObjectiveById(id: string): EditorialObjective | undefined {
  return EDITORIAL_OBJECTIVES.find(o => o.id === id)
}

export function getEditorialObjectivesByCategory(category: string): EditorialObjective[] {
  return EDITORIAL_OBJECTIVES.filter(o => o.category === category)
}
