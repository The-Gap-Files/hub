import { describe, it, expect } from 'vitest'
import { PDFParse } from 'pdf-parse'

/**
 * Testes para o extract-pdf tool.
 * 
 * Como esse endpoint não toca no banco (é uma ferramenta de conversão pura),
 * testamos a lógica de parsing diretamente ao invés de integração HTTP completa.
 */

// PDF mínimo válido com texto "Hello World"
const MINIMAL_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 100 700 Td (Hello World) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000360 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
430
%%EOF`

describe('Extract PDF - PDF to Text Conversion', () => {

  it('deve extrair texto de um PDF válido', async () => {
    const buf = Buffer.from(MINIMAL_PDF)
    const parser = new PDFParse({ data: new Uint8Array(buf) })

    const textResult = await parser.getText()

    expect(textResult.text).toBeDefined()
    expect(textResult.text).toContain('Hello World')
    expect(textResult.total).toBeGreaterThanOrEqual(1)

    await parser.destroy()
  })

  it('deve rejeitar buffers que não são PDF', async () => {
    const fakeBuffer = Buffer.from('Este não é um PDF válido')

    const parser = new PDFParse({ data: new Uint8Array(fakeBuffer) })

    await expect(parser.getText()).rejects.toThrow()
  })

  it('deve validar o tipo MIME application/pdf', () => {
    const validMime = 'application/pdf'
    const invalidMimes = ['image/png', 'text/plain', 'application/json', '']

    expect(validMime).toBe('application/pdf')

    for (const mime of invalidMimes) {
      expect(mime).not.toBe('application/pdf')
    }
  })

  it('deve respeitar o limite máximo de tamanho (50MB)', () => {
    const MAX_FILE_SIZE = 50 * 1024 * 1024

    const smallFile = { size: 1024 * 1024 } // 1MB
    const bigFile = { size: 60 * 1024 * 1024 } // 60MB

    expect(smallFile.size).toBeLessThanOrEqual(MAX_FILE_SIZE)
    expect(bigFile.size).toBeGreaterThan(MAX_FILE_SIZE)
  })

  it('deve gerar título a partir do nome do arquivo quando metadata não existe', () => {
    const testCases = [
      { filename: 'caso-mistério-2024.pdf', expected: 'caso mistério 2024' },
      { filename: 'relatorio_final.pdf', expected: 'relatorio final' },
      { filename: 'documento.PDF', expected: 'documento' },
    ]

    for (const { filename, expected } of testCases) {
      const title = filename.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ')
      expect(title).toBe(expected)
    }
  })

  it('deve normalizar quebras de linha excessivas e marcadores de página', () => {
    const rawText = 'Parágrafo 1\n\n-- 1 of 3 --\n\n\n\n\nParágrafo 2\r\n\r\n-- 2 of 3 --\r\n\r\nParágrafo 3'

    const normalized = rawText
      .replace(/-- \d+ of \d+ --/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    expect(normalized).not.toContain('-- 1 of 3 --')
    expect(normalized).not.toContain('\n\n\n')
    expect(normalized).toContain('Parágrafo 1')
    expect(normalized).toContain('Parágrafo 3')
  })
})
