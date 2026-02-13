import { NewsInvestigationService } from '../../services/news-investigation.service'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const refresh = query.refresh === 'true' || query.refresh === '1'
    const category = typeof query.category === 'string' ? query.category : undefined

    const news = await NewsInvestigationService.fetchLatestIntelligence({
      refresh,
      filterCategory: category
    })

    return {
      success: true,
      data: news,
      count: news.length,
      fromCache: !refresh
    }
  } catch (error) {
    console.error('API Error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Falha na interceptação de inteligência global.'
    })
  }
})
