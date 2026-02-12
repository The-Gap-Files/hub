/**
 * Ângulos Narrativos para Teasers
 * 
 * Cada ângulo representa uma "porta de entrada" diferente para o mesmo tema.
 * A IA escolhe os ângulos mais relevantes para o dossiê — NÃO é obrigada a usar todos.
 * 
 * Design: Universais — funcionam para conteúdo histórico, científico, futurista, etc.
 */

export interface NarrativeAngle {
  id: NarrativeAngleId
  name: string
  description: string
  /** Exemplo genérico de como o ângulo pode ser usado (ajuda a IA) */
  example: string
  /** Ícone Lucide para UI */
  icon: string
}

export type NarrativeAngleId =
  | 'cronologico'
  | 'economico'
  | 'ideologico'
  | 'politico'
  | 'humano'
  | 'conspirativo'
  | 'cientifico'
  | 'geopolitico'
  | 'cultural'
  | 'paradoxal'
  | 'conexao-temporal'
  | 'psicologico'
  | 'evidencial'
  | 'revisionista'
  | 'propagandistico'
  | 'tecnologico'
  | 'etico'

export const NARRATIVE_ANGLES: NarrativeAngle[] = [
  // ── Clássicos (funcionam para qualquer tema) ──────────────────
  {
    id: 'cronologico',
    name: 'Cronológico',
    description: 'Foco na timeline — velocidade dos eventos, datas impossíveis, lacunas temporais',
    example: '"Em 72 horas, tudo mudou. Veja o que aconteceu dia a dia."',
    icon: 'CalendarDays'
  },
  {
    id: 'economico',
    name: 'Econômico',
    description: 'Motivação financeira por trás dos eventos — "follow the money"',
    example: '"Ninguém fala sobre os 3 bilhões de dólares envolvidos."',
    icon: 'DollarSign'
  },
  {
    id: 'ideologico',
    name: 'Ideológico',
    description: 'Crenças, dogmas, ideologias — religião, doutrinas tecnológicas, fanatismo',
    example: '"Eles acreditavam nisso com tanta força que mataram por isso."',
    icon: 'Church'
  },
  {
    id: 'politico',
    name: 'Político',
    description: 'Relações de poder, influência, manipulação de narrativa oficial',
    example: '"Quem autorizou isso? E por que nunca respondeu?"',
    icon: 'Landmark'
  },
  {
    id: 'humano',
    name: 'Humano',
    description: 'Drama pessoal, destinos individuais, empatia com protagonistas',
    example: '"Ele tinha 2 anos. Nunca entendeu o que aconteceu ao redor dele."',
    icon: 'Heart'
  },
  {
    id: 'conspirativo',
    name: 'Conspirativo',
    description: 'O que está sendo escondido — quem se beneficia, gaps na versão oficial',
    example: '"Os documentos dizem uma coisa. O governo diz outra."',
    icon: 'ShieldAlert'
  },
  {
    id: 'cientifico',
    name: 'Científico',
    description: 'Evidências técnicas, dados contraditórios, análise baseada em fatos',
    example: '"Os números não fecham. E ninguém consegue explicar por quê."',
    icon: 'FlaskConical'
  },
  {
    id: 'geopolitico',
    name: 'Geopolítico',
    description: 'Impacto internacional, disputas entre nações, alianças e rivalidades',
    example: '"Três países disputam isso. Quem chegar primeiro controla o futuro."',
    icon: 'Globe'
  },
  {
    id: 'cultural',
    name: 'Cultural',
    description: 'Impacto na sociedade, legado, relevância moderna, transformação social',
    example: '"Isso mudou como uma geração inteira pensa sobre o assunto."',
    icon: 'Users'
  },
  {
    id: 'paradoxal',
    name: 'Paradoxal',
    description: 'Contradições internas, ironia histórica, lógicas que não fecham',
    example: '"Como é possível que fizemos isso em 1969 e não conseguimos mais?"',
    icon: 'Shuffle'
  },

  // ── Novos (expandem a cobertura temática) ─────────────────────
  {
    id: 'conexao-temporal',
    name: 'Conexão Temporal',
    description: 'Liga o evento a algo de outra época — passado↔presente OU presente↔futuro',
    example: '"Em 2019, alguém matou por causa de uma história de 500 anos atrás."',
    icon: 'Link'
  },
  {
    id: 'psicologico',
    name: 'Psicológico',
    description: 'A mente por trás dos eventos — histeria coletiva, vieses, manipulação psicológica',
    example: '"Uma cidade INTEIRA acreditou numa mentira. Como isso é possível?"',
    icon: 'Brain'
  },
  {
    id: 'evidencial',
    name: 'Evidencial',
    description: 'Análise de provas, dados, autópsias, registros — estilo forense/investigativo',
    example: '"A autópsia dizia uma coisa. O julgamento disse outra."',
    icon: 'Search'
  },
  {
    id: 'revisionista',
    name: 'Revisionista',
    description: 'Como a versão oficial mudou — retrações, desclassificações, revisões',
    example: '"Durante 500 anos todos acreditaram numa versão. Até que alguém releu os originais."',
    icon: 'RotateCcw'
  },
  {
    id: 'propagandistico',
    name: 'Propagandístico',
    description: 'Como o evento foi usado como arma narrativa — desinformação, instrumentalização',
    example: '"A morte dele foi transformada em arma. E funcionou por séculos."',
    icon: 'Megaphone'
  },
  {
    id: 'tecnologico',
    name: 'Tecnológico',
    description: 'Foco na tecnologia — como funciona, limites, viabilidade, inovação disruptiva',
    example: '"A tecnologia pra fazer isso AINDA NÃO EXISTE. E já estão investindo bilhões."',
    icon: 'Cpu'
  },
  {
    id: 'etico',
    name: 'Ético / Moral',
    description: 'Dilemas morais — quem tem direito, quem paga o preço, consequências éticas',
    example: '"Quem deu o direito a alguém de fazer isso? E quem vai pagar?"',
    icon: 'Scale'
  }
]

// ── Helpers ──────────────────────────────────────────────────────

export function getNarrativeAngleById(id: string): NarrativeAngle | undefined {
  return NARRATIVE_ANGLES.find(a => a.id === id)
}

export function getNarrativeAngleIds(): NarrativeAngleId[] {
  return NARRATIVE_ANGLES.map(a => a.id)
}
