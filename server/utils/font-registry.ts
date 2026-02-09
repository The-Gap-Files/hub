/**
 * Registra fontes customizadas para uso com Sharp/librsvg.
 * 
 * Sharp usa librsvg → fontconfig para renderizar texto em SVGs.
 * Este módulo configura o fontconfig para encontrar nossas fontes 
 * (Bebas Neue, Creepster, Bangers) sem precisar instalá-las no sistema.
 */

import { resolve, dirname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'

// Diretório onde as fontes estão
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const FONTS_DIR = resolve(__dirname, '../assets/fonts')

let registered = false

/**
 * Configura fontconfig para encontrar as fontes customizadas.
 * Deve ser chamado antes de qualquer operação Sharp com SVG que use fontes custom.
 */
export function registerCustomFonts(): void {
  if (registered) return

  try {
    // Ler template do fonts.conf
    const confTemplate = resolve(FONTS_DIR, 'fonts.conf')
    if (!existsSync(confTemplate)) {
      console.warn('[Fonts] ⚠️ fonts.conf não encontrado em', confTemplate)
      return
    }

    // Criar fonts.conf com path absoluto
    const confContent = readFileSync(confTemplate, 'utf-8')
      .replace('FONTS_DIR_PLACEHOLDER', FONTS_DIR.replace(/\\/g, '/'))

    // Salvar em /tmp (ou temp do sistema) para não poluir o projeto
    const tmpDir = process.env.TEMP || process.env.TMP || '/tmp'
    const runtimeConf = resolve(tmpDir, 'thegapfiles-fonts.conf')
    writeFileSync(runtimeConf, confContent)

    // Definir variável de ambiente ANTES de qualquer uso do Sharp
    process.env.FONTCONFIG_FILE = runtimeConf

    // Verificar quais fontes estão disponíveis
    const fontFiles = ['BebasNeue-Regular.ttf', 'Creepster-Regular.ttf', 'Bangers-Regular.ttf']
    const available = fontFiles.filter(f => existsSync(resolve(FONTS_DIR, f)))

    console.log(`[Fonts] ✅ ${available.length} fontes registradas: ${available.join(', ')}`)
    console.log(`[Fonts]    FONTCONFIG_FILE = ${runtimeConf}`)

    registered = true
  } catch (error: any) {
    console.warn(`[Fonts] ⚠️ Falha ao registrar fontes: ${error.message}`)
    console.warn('[Fonts]    O overlay usará fontes do sistema como fallback')
  }
}

/**
 * Retorna o font-family CSS correto para o tema.
 * Prioriza a fonte customizada e faz fallback para fonts do sistema.
 */
export function getFontFamily(theme: 'horror' | 'impact' | 'playful'): string {
  switch (theme) {
    case 'horror':
      return "'Creepster', 'Impact', 'Arial Black', sans-serif"
    case 'playful':
      return "'Bangers', 'Impact', 'Arial Black', sans-serif"
    case 'impact':
    default:
      return "'Bebas Neue', 'Impact', 'Arial Black', sans-serif"
  }
}
