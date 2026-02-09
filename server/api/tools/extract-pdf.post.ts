/**
 * POST /api/tools/extract-pdf
 * 
 * Recebe um PDF via multipart/form-data e extrai o texto.
 * Não salva nada no banco — é apenas uma ferramenta de conversão.
 */
import { PDFParse } from 'pdf-parse'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)

  if (!parts || parts.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Nenhum arquivo enviado'
    })
  }

  const filePart = parts.find(p => p.name === 'file')

  if (!filePart || !filePart.data) {
    throw createError({
      statusCode: 400,
      message: 'Campo "file" é obrigatório'
    })
  }

  // Validar tipo MIME
  const mimeType = filePart.type || ''
  if (mimeType !== 'application/pdf') {
    throw createError({
      statusCode: 422,
      message: `Tipo de arquivo inválido: ${mimeType}. Apenas PDF é aceito.`
    })
  }

  // Validar tamanho
  if (filePart.data.length > MAX_FILE_SIZE) {
    const sizeMB = (filePart.data.length / (1024 * 1024)).toFixed(1)
    throw createError({
      statusCode: 422,
      message: `Arquivo muito grande (${sizeMB}MB). Máximo permitido: 50MB.`
    })
  }

  let parser: InstanceType<typeof PDFParse> | null = null

  try {
    const data = new Uint8Array(filePart.data)
    parser = new PDFParse({ data })

    const textResult = await parser.getText()
    const infoResult = await parser.getInfo()

    const text = textResult.text
      .replace(/-- \d+ of \d+ --/g, '') // Remove marcadores de página do pdf-parse
      .replace(/\r\n/g, '\n')           // Normalizar quebras
      .replace(/\n{3,}/g, '\n\n')       // Limitar quebras excessivas
      .trim()

    if (text.length < 10) {
      throw createError({
        statusCode: 422,
        message: 'PDF não contém texto extraível. O documento pode ser baseado em imagens (escaneado). Tente um PDF com texto selecionável.'
      })
    }

    // Título: metadata do PDF > nome do arquivo > fallback
    const fileName = filePart.filename || ''
    const pdfTitle = infoResult.info?.Title
    const title = pdfTitle
      || fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ')
      || 'Documento PDF'

    const pageCount = textResult.total || textResult.pages?.length || 0
    const wordCount = text.split(/\s+/).filter((w: string) => w.length > 0).length

    console.log(`[ExtractPDF] ✅ "${title}" — ${pageCount} páginas, ${wordCount.toLocaleString()} palavras`)

    return {
      success: true,
      data: {
        title: title.trim(),
        content: text,
        pageCount,
        wordCount
      }
    }
  } catch (error: any) {
    // Se já é um createError (validação), propagar
    if (error.statusCode) throw error

    console.error('[ExtractPDF] ❌ Erro ao processar PDF:', error)
    throw createError({
      statusCode: 500,
      message: 'Erro ao processar o PDF. Verifique se o arquivo não está corrompido.'
    })
  } finally {
    if (parser) {
      try { await parser.destroy() } catch { /* ignore cleanup errors */ }
    }
  }
})
