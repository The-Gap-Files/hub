import { z } from 'zod'
import * as cheerio from 'cheerio'

const ExtractUrlSchema = z.object({
  url: z.string().url()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const validation = ExtractUrlSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: 'URL inválida ou ausente'
    })
  }

  const { url } = validation.data

  try {
    // 1. Fetch da página com headers de browser para evitar bloqueios simples
    const html = await $fetch<string>(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    // 2. Carregar Cheerio
    const $ = cheerio.load(html)

    // 3. Limpeza inicial (remover scripts, styles, anúncios comuns)
    $('script, style, iframe, nav, footer, header, aside, .ad, .ads, .advertisement, .cookie-banner, .popup').remove()

    // 4. Extração de Metadados
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      $('h1').first().text() ||
      'Sem título identificado'

    const author =
      $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') ||
      undefined

    // 5. Extração Inteligente de Conteúdo
    let content = ''

    // Tentativa A: Tag <article> (Padrão semântico moderno)
    if ($('article').length > 0) {
      content = $('article').text()
    }
    // Tentativa B: Tag <main>
    else if ($('main').length > 0) {
      content = $('main').find('p').map((i, el) => $(el).text()).get().join('\n\n')
    }
    // Tentativa C: Agregado de parágrafos do corpo (Fallback agressivo)
    else {
      // Pega parágrafos que tenham um tamanho mínimo de texto para evitar menus/links soltos
      content = $('body').find('p')
        .filter((i, el) => $(el).text().trim().length > 20)
        .map((i, el) => $(el).text())
        .get()
        .join('\n\n')
    }

    // 6. Limpeza final do texto
    content = content
      .replace(/\s+/g, ' ') // Remove múltiplos espaços/quebras
      .replace(/\n\s*\n/g, '\n\n') // Normaliza parágrafos
      .trim()

    if (content.length < 50) {
      throw new Error('Conteúdo extraído insuficiente ou protegido.')
    }

    return {
      success: true,
      data: {
        title: title.trim(),
        content: content,
        author: author?.trim()
      }
    }

  } catch (error: any) {
    console.error('Erro ao extrair URL:', error)
    throw createError({
      statusCode: 502, // Bad Gateway (erro na comunicação externa)
      message: `Erro ao ler a página: ${error.message || 'Falha desconhecida'}`
    })
  }
})
