import { prisma } from '../utils/prisma'

export interface NewsItem {
  title: string
  link: string
  summary: string
  source: string
  category: string
  publishedAt: string | null
  author: string | null
}

const SOURCES = [
  // ── PARANORMAL & HIGH STRANGENESS ──
  {
    name: 'Anomalien',
    url: 'https://anomalien.com/feed/',
    category: 'paranormal'
  },
  {
    name: 'UFO Sightings Daily',
    url: 'https://www.ufosightingsdaily.com/feeds/posts/default?alt=rss',
    category: 'paranormal'
  },
  {
    name: 'Fortean News',
    url: 'https://feed.podbean.com/forteannews/feed.xml',
    category: 'paranormal'
  },

  // ── SCIENCE & UNEXPLAINED ──
  {
    name: 'LiveScience',
    url: 'https://www.livescience.com/feeds/all',
    category: 'science'
  },

  // ── TRUE CRIME & MYSTERIES ──
  {
    name: 'CrimeReads',
    url: 'https://crimereads.com/feed/',
    category: 'true-crime'
  },

  // ── SERIAL KILLERS & MURDER ──
  {
    name: 'Oxygen True Crime',
    url: 'https://www.oxygen.com/feeds/true-crime/rss',
    category: 'serial-killer'
  },
  {
    name: 'All That Is Interesting (Crime)',
    url: 'https://allthatsinteresting.com/tag/true-crime/feed',
    category: 'serial-killer'
  },
  {
    name: 'Murder Mile UK',
    url: 'https://audioboom.com/channels/4988498.rss',
    category: 'serial-killer'
  },
  {
    name: 'Crime Museum',
    url: 'https://www.crimemuseum.org/feed/',
    category: 'serial-killer'
  },

  // ── DEEP JOURNALISM & LONG-FORM ──
  {
    name: 'The Guardian: Long Read',
    url: 'https://www.theguardian.com/news/series/the-long-read/rss',
    category: 'journalism'
  },
  {
    name: 'The Guardian: Science',
    url: 'https://www.theguardian.com/science/rss',
    category: 'science'
  },
  {
    name: 'The Guardian: World',
    url: 'https://www.theguardian.com/world/rss',
    category: 'journalism'
  },

  // ── GEOPOLITICS & GLOBAL DECISIONS ──
  {
    name: 'Foreign Affairs',
    url: 'https://www.foreignaffairs.com/rss.xml',
    category: 'geopolitics'
  },
  {
    name: 'The Diplomat',
    url: 'https://thediplomat.com/feed/',
    category: 'geopolitics'
  },
  {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    category: 'geopolitics'
  },
  {
    name: 'Reuters: World',
    url: 'https://www.reutersagency.com/feed/',
    category: 'geopolitics'
  },
  {
    name: 'CSIS',
    url: 'https://www.csis.org/analysis/feed',
    category: 'geopolitics'
  },

  // ── WEIRD NEWS ──
  {
    name: 'Oddee (Weird News)',
    url: 'https://feeds.feedburner.com/oddee',
    category: 'weird'
  },
  {
    name: 'AP News: Oddities',
    url: 'https://rsshub.app/apnews/topics/oddities',
    category: 'weird'
  }
]

export const NewsInvestigationService = {
  /**
   * Retorna notícias do banco de dados.
   * Se `refresh` for true, busca dos RSS primeiro e persiste novos itens antes de retornar.
   */
  async fetchLatestIntelligence(options?: { refresh?: boolean; filterCategory?: string }): Promise<NewsItem[]> {
    const { refresh = false, filterCategory } = options ?? {}

    // Se refresh, buscar dos feeds e persistir novos
    if (refresh) {
      await this.refreshFromFeeds(filterCategory)
    }

    // Retornar do banco (sempre — é a fonte da verdade)
    const where: any = { dismissed: false }
    if (filterCategory) where.category = filterCategory

    const items = await prisma.newsItem.findMany({
      where,
      orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } },
      take: 200
    })

    return items.map(item => ({
      title: item.title,
      link: item.link,
      summary: item.summary ?? '',
      source: item.source,
      category: item.category,
      publishedAt: item.publishedAt?.toISOString() ?? null,
      author: item.author ?? null
    }))
  },

  /**
   * Busca RSS feeds e persiste novos itens no banco (deduplicação por link).
   */
  async refreshFromFeeds(filterCategory?: string): Promise<number> {
    const sourcesToFetch = filterCategory
      ? SOURCES.filter(s => s.category === filterCategory)
      : SOURCES

    const allNews: NewsItem[] = []

    const results = await Promise.allSettled(
      sourcesToFetch.map(source => fetchSingleSource(source))
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allNews.push(...result.value)
      }
    }

    // Persistir novos itens (ignorar duplicatas por link)
    let saved = 0
    for (const item of allNews) {
      try {
        await prisma.newsItem.upsert({
          where: { link: item.link },
          create: {
            title: item.title,
            link: item.link,
            summary: item.summary || null,
            source: item.source,
            category: item.category,
            author: item.author || null,
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : null
          },
          update: {} // Não atualizar se já existe — preservar dados originais
        })
        saved++
      } catch (e) {
        // Ignorar erros de duplicata ou constraint — continuar com próximo
      }
    }

    console.log(`[NewsService] 📦 ${saved} itens processados, ${allNews.length} capturados dos feeds.`)
    return saved
  },

  getCategories() {
    return [...new Set(SOURCES.map(s => s.category))]
  }
}

async function fetchSingleSource(source: { name: string; url: string; category: string }): Promise<NewsItem[]> {
  const items: NewsItem[] = []
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000) // 8s timeout per feed

  try {
    const { load } = await import('cheerio')

    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    })

    if (!response.ok) {
      console.warn(`[NewsService] Falha ao buscar ${source.name}: ${response.status}`)
      return items
    }

    const xmlText = await response.text()
    const $ = load(xmlText, { xmlMode: true })

    $('item').each((_, element) => {
      const item = $(element)
      const title = item.find('title').text()
      const link = item.find('link').text()
      const description = item.find('description').text() || item.find('content\\:encoded').text()
      const pubDate = item.find('pubDate').text()
      const creator = item.find('dc\\:creator').text()

      if (title && link) {
        items.push({
          title: title.replace('<![CDATA[', '').replace(']]>', '').trim(),
          link: link.trim(),
          summary: description.replace(/<[^>]*>/g, '').slice(0, 300).trim(),
          source: source.name,
          category: source.category,
          publishedAt: pubDate || null,
          author: creator || null
        })
      }
    })

    console.log(`[NewsService] ✅ ${source.name}: ${items.length} items`)
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`[NewsService] ⏱️ Timeout: ${source.name}`)
    } else {
      console.warn(`[NewsService] ❌ ${source.name}: ${error.message}`)
    }
  } finally {
    clearTimeout(timeout)
  }

  return items
}
