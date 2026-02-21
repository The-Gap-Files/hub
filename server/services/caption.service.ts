/**
 * Caption Service – Geração de legendas a partir dos dados das cenas
 * 
 * NOVO FLUXO (sem Whisper):
 *   Scene.narration (texto) + AudioTrack.fileData (duração real via ffprobe) → ASS → FFmpeg
 * 
 * O texto já existe no script e a duração real é extraída do áudio via ffprobe.
 * Não há necessidade de transcrever algo que nós mesmos geramos.
 * 
 * IMPORTANTE: A duração no banco (audioTrack.duration) é uma ESTIMATIVA imprecisa.
 * O ffprobe extrai a duração REAL do arquivo MP3, garantindo sincronização perfeita
 * com o vídeo (que também usa ffprobe para a renderização).
 * 
 * Efeitos suportados via formato ASS:
 *   - fade         → \fad(in,out)
 *   - word_highlight → \c alternando por palavra via \t
 *   - karaoke_fill  → \kf (preenchimento progressivo)
 *   - karaoke_glow  → \kf + \blur
 *   - pop_in        → \fscx\fscy animados via \t
 *   - glow_pulse    → \blur animado via \t
 *   - neon_flicker  → \alpha alternando via \t
 */

import { promises as fs, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import ffprobeInstaller from '@ffprobe-installer/ffprobe'
import { createPipelineLogger } from '../utils/pipeline-logger'
import {
  type CaptionStyleId,
  type CaptionStyle,
  type CaptionEffect,
  CAPTION_STYLES,
  hexToASS
} from '../constants/cinematography/caption-styles'

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

/** Word timing vindo do ElevenLabs /with-timestamps */
export interface WordTimingData {
  word: string
  startTime: number   // em segundos (absoluto dentro da cena)
  endTime: number     // em segundos
}

/** Dados de uma cena para geração de legendas */
export interface SceneCaptionData {
  narration: string              // Texto da narração
  audioDuration: number          // Duração estimada do áudio (fallback)
  audioFileData?: Buffer         // Buffer do arquivo de áudio (para extrair duração real via ffprobe)
  wordTimings?: WordTimingData[] // Word-level timestamps do ElevenLabs (precisão perfeita)
  order: number                  // Ordem da cena
}

export interface CaptionOptions {
  styleId?: CaptionStyleId
}

export interface SubtitleExportOptions extends CaptionOptions {
  /** Duração real do vídeo renderizado (via ffprobe). Quando fornecida,
   *  todos os timestamps são escalados proporcionalmente para eliminar drift. */
  actualVideoDuration?: number
}

export interface CaptionFromScenesResult {
  captionedBuffer: Buffer
  styleUsed: CaptionStyleId
  scenesProcessed: number
}

// ---------------------------------------------------------------------------
//  FFmpeg Path Resolver
// ---------------------------------------------------------------------------

function getFFmpegPath(): string {
  if (process.platform === 'win32') {
    const cwd = process.cwd()
    const candidates = [
      join(cwd, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
      String.raw`C:\Sistemas diversos\thegapfiles\hub\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe`
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
  }
  return 'ffmpeg'
}

/** Logo no rodapé direito: tenta public/logo-footer.png, public/logo.png ou public/logo.jpeg (FFmpeg não suporta SVG). */
function getFooterLogoPath(): string | null {
  const cwd = process.cwd()
  const candidates = [
    join(cwd, 'public', 'logo-footer.png'),
    join(cwd, 'public', 'logo.png'),
    join(cwd, 'public', 'logo.jpeg'),
    join(cwd, 'public', 'logo.jpg')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

// ---------------------------------------------------------------------------
//  CaptionService
// ---------------------------------------------------------------------------

export class CaptionService {

  /**
   * Gera vídeo com legendas a partir dos dados das cenas (SEM Whisper)
   * 
   * Fluxo:
   *   1. Recebe Buffer do vídeo + dados das cenas (texto + duração)
   *   2. Calcula offsets acumulados para posicionar cada legenda
   *   3. Gera ASS com efeitos avançados baseado no estilo
   *   4. Aplica com FFmpeg (filtro ass=)
   *   5. Retorna Buffer do vídeo legendado
   */
  async addCaptionsFromScenes(
    videoBuffer: Buffer,
    scenes: SceneCaptionData[],
    options: CaptionOptions = {}
  ): Promise<CaptionFromScenesResult> {
    const log = createPipelineLogger({ stage: 'Captions' })
    const { styleId = 'tiktok_viral' } = options
    const style = CAPTION_STYLES[styleId]

    log.info(`Gerando legendas a partir de ${scenes.length} cenas.`)
    log.info(`Estilo: ${style.name} (${style.effect}).`)

    // 0. Extrair duração REAL dos áudios via ffprobe (corrige dessincronização)
    const scenesWithRealDuration = await this.resolveRealDurations(scenes)

    // 1. Calcular segmentos com offsets acumulados
    const segments = this.buildSegmentsFromScenes(scenesWithRealDuration, style)
    log.info(`${segments.length} segmentos de legenda gerados.`)

    // 2. Gerar conteúdo ASS com efeitos
    const assContent = this.generateASS(segments, style)

    // 3. Aplicar legendas com FFmpeg
    const captionedBuffer = await this.applyASSToVideo(videoBuffer, assContent)
    log.info('Legendas aplicadas com sucesso.')

    return {
      captionedBuffer,
      styleUsed: styleId,
      scenesProcessed: scenes.length
    }
  }

  // =========================================================================
  //  Segmentação do texto
  // =========================================================================

  /**
   * Constrói segmentos de legenda a partir das cenas
   * 
   * Prioridade de timing:
   *   1. wordTimings do ElevenLabs (precisão perfeita, por palavra)
   *   2. Duração real via ffprobe (resolveRealDurations, por cena)
   *   3. Duração estimada do banco (fallback)
   * 
   * NOTA: Para legendas SRT/VTT externas, o drift acumulativo é corrigido
   * via scaling proporcional em scaleSegmentsToVideoDuration() — não aqui.
   */
  private buildSegmentsFromScenes(
    scenes: SceneCaptionData[],
    style: CaptionStyle
  ): CaptionSegment[] {
    const segments: CaptionSegment[] = []
    let currentOffset = 0

    for (const scene of scenes) {
      const text = scene.narration.trim()
      if (!text) {
        currentOffset += scene.audioDuration
        continue
      }

      // Se temos word timings reais do ElevenLabs, usar para sincronização perfeita
      if (scene.wordTimings && scene.wordTimings.length > 0) {
        const sceneSegments = this.buildSegmentsFromWordTimings(
          scene.wordTimings,
          currentOffset,
          style
        )
        segments.push(...sceneSegments)
      } else {
        // Fallback: distribuição proporcional por número de palavras
        const captLog = createPipelineLogger({ stage: 'Captions' })
        captLog.warn(`Cena ${scene.order + 1}: sem word timings; usando distribuição proporcional.`)
        const sceneSegments = this.buildSegmentsUniform(
          text,
          scene.audioDuration,
          currentOffset,
          style
        )
        segments.push(...sceneSegments)
      }

      // SEMPRE avançar offset pela duração real do áudio da cena (via ffprobe).
      // Não usar lastWord.endTime — o áudio pode ter silêncio trailing após a
      // última palavra, e o vídeo usa a duração completa do MP3 para cada cena.
      // Se usássemos o endTime da última palavra, o offset acumularia um delta
      // por cena, fazendo a legenda adiantar progressivamente.
      currentOffset += scene.audioDuration
    }

    return segments
  }

  /**
   * Constrói segmentos usando word timings REAIS do ElevenLabs
   * 
   * Agrupa palavras em blocos respeitando maxCharsPerLine * maxLines,
   * usando os timestamps reais de início/fim de cada palavra.
   */
  private buildSegmentsFromWordTimings(
    wordTimings: WordTimingData[],
    sceneOffset: number,
    style: CaptionStyle
  ): CaptionSegment[] {
    const segments: CaptionSegment[] = []
    const maxCharsPerBlock = style.maxCharsPerLine * style.maxLines

    let blockWords: { text: string; startTime: number; endTime: number }[] = []
    let blockChars = 0

    for (let i = 0; i < wordTimings.length; i++) {
      const wt = wordTimings[i]!
      const wordLen = wt.word.length + (blockWords.length > 0 ? 1 : 0) // +1 para espaço

      // Se excede o bloco, fechar e começar novo
      if (blockChars + wordLen > maxCharsPerBlock && blockWords.length > 0) {
        segments.push(this.createSegmentFromWords(blockWords, sceneOffset, style))
        blockWords = []
        blockChars = 0
      }

      // Quebra natural em pontuação forte (se bloco já tem conteúdo suficiente)
      const isPunctuation = /[.!?]$/.test(wt.word)
      blockWords.push({ text: wt.word, startTime: wt.startTime, endTime: wt.endTime })
      blockChars += wt.word.length + (blockWords.length > 1 ? 1 : 0)

      if (isPunctuation && blockChars > maxCharsPerBlock * 0.4) {
        segments.push(this.createSegmentFromWords(blockWords, sceneOffset, style))
        blockWords = []
        blockChars = 0
      }
    }

    // Último bloco
    if (blockWords.length > 0) {
      segments.push(this.createSegmentFromWords(blockWords, sceneOffset, style))
    }

    return segments
  }

  /** Cria um CaptionSegment a partir de um grupo de palavras com timings reais */
  private createSegmentFromWords(
    blockWords: { text: string; startTime: number; endTime: number }[],
    sceneOffset: number,
    style: CaptionStyle
  ): CaptionSegment {
    const firstWord = blockWords[0]!
    const lastWord = blockWords[blockWords.length - 1]!

    const segmentStart = sceneOffset + firstWord.startTime
    const segmentEnd = sceneOffset + lastWord.endTime

    // Word timings relativos ao início do segmento (para efeitos karaoke/highlight)
    const words: WordTiming[] = []
    if (this.needsWordTiming(style.effect)) {
      for (const bw of blockWords) {
        const relativeStart = bw.startTime - firstWord.startTime
        const wordDuration = bw.endTime - bw.startTime
        words.push({
          text: bw.text,
          startMs: Math.round(relativeStart * 1000),
          durationMs: Math.round(wordDuration * 1000)
        })
      }
    }

    return {
      text: blockWords.map(w => w.text).join(' '),
      startTime: segmentStart,
      endTime: segmentEnd,
      words
    }
  }

  /**
   * Fallback: constrói segmentos com distribuição uniforme por palavras
   * (usado quando não há word timings do ElevenLabs)
   */
  private buildSegmentsUniform(
    text: string,
    audioDuration: number,
    sceneOffset: number,
    style: CaptionStyle
  ): CaptionSegment[] {
    const segments: CaptionSegment[] = []
    const blocks = this.splitTextIntoBlocks(text, style.maxCharsPerLine, style.maxLines)

    const totalWords = text.split(/\s+/).length
    const timePerWord = audioDuration / totalWords
    let blockOffset = sceneOffset

    for (const block of blocks) {
      const blockWordCount = block.split(/\s+/).length
      const blockDuration = blockWordCount * timePerWord

      const words: WordTiming[] = []
      if (this.needsWordTiming(style.effect)) {
        const wordList = block.split(/\s+/)
        const wordDuration = blockDuration / wordList.length
        let wordOffset = 0

        for (const word of wordList) {
          words.push({
            text: word,
            startMs: Math.round(wordOffset * 1000),
            durationMs: Math.round(wordDuration * 1000)
          })
          wordOffset += wordDuration
        }
      }

      segments.push({
        text: block,
        startTime: blockOffset,
        endTime: blockOffset + blockDuration,
        words
      })

      blockOffset += blockDuration
    }

    return segments
  }

  /**
   * Divide texto em blocos respeitando limites de caracteres e linhas
   * Quebra em fronteiras de palavras, respeitando pontuação como ponto de quebra natural
   */
  private splitTextIntoBlocks(
    text: string,
    maxCharsPerLine: number,
    maxLines: number
  ): string[] {
    const maxCharsPerBlock = maxCharsPerLine * maxLines
    const words = text.split(/\s+/)
    const blocks: string[] = []
    let currentBlock = ''

    for (const word of words) {
      const candidate = currentBlock ? `${currentBlock} ${word}` : word

      if (candidate.length > maxCharsPerBlock) {
        // Bloco cheio — salva e começa novo
        if (currentBlock) blocks.push(currentBlock)
        currentBlock = word
      } else {
        currentBlock = candidate

        // Se termina com pontuação forte, fecha o bloco naturalmente
        if (/[.!?]$/.test(word) && currentBlock.length > maxCharsPerBlock * 0.4) {
          blocks.push(currentBlock)
          currentBlock = ''
        }
      }
    }

    if (currentBlock.trim()) {
      blocks.push(currentBlock)
    }

    return blocks
  }

  /** Retorna true se o efeito precisa de timing por palavra */
  private needsWordTiming(effect: CaptionEffect): boolean {
    return ['word_highlight', 'karaoke_fill', 'karaoke_glow'].includes(effect)
  }

  // =========================================================================
  //  Geração ASS
  // =========================================================================

  /**
   * Gera conteúdo ASS completo com efeitos avançados
   */
  private generateASS(segments: CaptionSegment[], style: CaptionStyle): string {
    const header = this.buildASSHeader(style)
    const dialogues = segments.map(seg => this.buildDialogue(seg, style)).join('\n')

    return `${header}\n${dialogues}\n`
  }

  /** Cabeçalho ASS com definição do estilo */
  private buildASSHeader(style: CaptionStyle): string {
    const primary = hexToASS(style.primaryColor)
    const secondary = hexToASS(style.secondaryColor)
    const outline = hexToASS(style.outlineColor)
    const back = hexToASS(style.backgroundColor)

    // Para efeitos de karaoke, a SecondaryColour é usada como cor "preenchida"
    // PrimaryColour = cor antes de preencher, SecondaryColour = cor após preencher
    const isKaraoke = ['karaoke_fill', 'karaoke_glow'].includes(style.effect)

    const lines = [
      '[Script Info]',
      'Title: The Gap Files - Captions',
      'ScriptType: v4.00+',
      'WrapStyle: 0',
      'PlayResX: 1080',
      'PlayResY: 1920',
      'ScaledBorderAndShadow: yes',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      // Estilo principal
      `Style: Default,${style.fontName},${style.fontSize},${isKaraoke ? secondary : primary},${isKaraoke ? primary : secondary},${outline},${back},${style.bold ? '1' : '0'},${style.italic ? '1' : '0'},0,0,100,100,0,0,1,${style.outline},${style.shadow},${style.alignment},${style.marginH},${style.marginH},${style.marginV},1`,
    ]

    // Estilo de glow (usado como camada extra por trás para efeitos glow/neon)
    if (['glow_pulse', 'neon_flicker'].includes(style.effect)) {
      const glowColor = hexToASS(style.effectOptions.glowColor || style.secondaryColor)
      const glowRadius = style.effectOptions.glowRadius || 8
      lines.push(
        `Style: Glow,${style.fontName},${style.fontSize},${glowColor},${secondary},${glowColor},&H00000000,${style.bold ? '1' : '0'},${style.italic ? '1' : '0'},0,0,100,100,0,0,1,${glowRadius},0,${style.alignment},${style.marginH},${style.marginH},${style.marginV},1`
      )
    }

    lines.push(
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
    )

    return lines.join('\n')
  }

  /**
   * Gera uma linha Dialogue com efeitos baseados no estilo
   */
  private buildDialogue(segment: CaptionSegment, style: CaptionStyle): string {
    const start = this.formatASSTime(segment.startTime)
    const end = this.formatASSTime(segment.endTime)
    const dialogues: string[] = []

    switch (style.effect) {
      case 'fade': {
        const fadeIn = style.effectOptions.fadeInMs || 200
        const fadeOut = style.effectOptions.fadeOutMs || 200
        const text = segment.text.replace(/\n/g, '\\N')
        dialogues.push(
          `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\fad(${fadeIn},${fadeOut})}${text}`
        )
        break
      }

      case 'word_highlight': {
        const text = this.buildWordHighlightText(segment, style)
        dialogues.push(
          `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`
        )
        break
      }

      case 'karaoke_fill': {
        const text = this.buildKaraokeText(segment, false)
        const fadeIn = style.effectOptions.fadeInMs || 50
        const fadeOut = style.effectOptions.fadeOutMs || 50
        dialogues.push(
          `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\fad(${fadeIn},${fadeOut})}${text}`
        )
        break
      }

      case 'karaoke_glow': {
        const text = this.buildKaraokeText(segment, true)
        dialogues.push(
          `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`
        )
        break
      }

      case 'pop_in': {
        const fadeIn = style.effectOptions.fadeInMs || 150
        const fadeOut = style.effectOptions.fadeOutMs || 100
        const text = segment.text.replace(/\n/g, '\\N')
        // Pop: scale de 0% → 100% + fade
        dialogues.push(
          `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\fscx0\\fscy0\\fad(0,${fadeOut})\\t(0,${fadeIn},\\fscx100\\fscy100)}${text}`
        )
        break
      }

      case 'glow_pulse': {
        const text = segment.text.replace(/\n/g, '\\N')
        const fadeIn = style.effectOptions.fadeInMs || 150
        const fadeOut = style.effectOptions.fadeOutMs || 150
        const durationMs = Math.round((segment.endTime - segment.startTime) * 1000)
        const halfDuration = Math.round(durationMs / 2)

        // Camada de glow (por trás) com blur pulsante
        dialogues.push(
          `Dialogue: 0,${start},${end},Glow,,0,0,0,,{\\blur6\\fad(${fadeIn},${fadeOut})\\t(0,${halfDuration},\\blur12)\\t(${halfDuration},${durationMs},\\blur6)}${text}`
        )
        // Camada principal (por cima) com fade
        dialogues.push(
          `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\fad(${fadeIn},${fadeOut})}${text}`
        )
        break
      }

      case 'neon_flicker': {
        const text = segment.text.replace(/\n/g, '\\N')
        const fadeIn = style.effectOptions.fadeInMs || 80
        const fadeOut = style.effectOptions.fadeOutMs || 80

        // Camada de glow (neon outer glow)
        dialogues.push(
          `Dialogue: 0,${start},${end},Glow,,0,0,0,,{\\blur10\\fad(${fadeIn},${fadeOut})\\t(0,80,\\alpha&H40&)\\t(80,160,\\alpha&H00&)\\t(160,240,\\alpha&H30&)\\t(240,320,\\alpha&H00&)}${text}`
        )
        // Camada principal
        dialogues.push(
          `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\fad(${fadeIn},${fadeOut})}${text}`
        )
        break
      }

      case 'none':
      default: {
        const text = segment.text.replace(/\n/g, '\\N')
        dialogues.push(
          `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`
        )
        break
      }
    }

    return dialogues.join('\n')
  }

  /**
   * Gera texto ASS com word highlight (cada palavra muda de cor quando ativa)
   * 
   * Usa override tags \t para transicionar a cor de cada palavra
   * no momento exato em que ela é falada.
   */
  private buildWordHighlightText(segment: CaptionSegment, style: CaptionStyle): string {
    if (!segment.words.length) {
      return segment.text.replace(/\n/g, '\\N')
    }

    const highlightColor = hexToASS(style.effectOptions.highlightColor || style.secondaryColor)
    const normalColor = hexToASS(style.primaryColor)
    const fadeIn = style.effectOptions.fadeInMs || 100
    const fadeOut = style.effectOptions.fadeOutMs || 100

    // Construir texto com override tags por palavra
    let result = `{\\fad(${fadeIn},${fadeOut})}`

    for (let i = 0; i < segment.words.length; i++) {
      const word = segment.words[i]
      if (!word) continue

      const wordEnd = word.startMs + word.durationMs

      // Cada palavra: cor normal → cor highlight no startMs → cor normal no endMs
      result += `{\\c${normalColor}\\t(${word.startMs},${word.startMs + 50},\\c${highlightColor})\\t(${wordEnd - 50},${wordEnd},\\c${normalColor})}${word.text}`

      // Espaço entre palavras (exceto última)
      if (i < segment.words.length - 1) {
        result += ' '
      }
    }

    return result
  }

  /**
   * Gera texto ASS com efeito karaoke (\kf = fill progressivo)
   * 
   * \kf{duração}: preenche a sílaba/palavra progressivamente
   * A duração é em centissegundos (1/100 de segundo)
   */
  private buildKaraokeText(segment: CaptionSegment, withGlow: boolean): string {
    if (!segment.words.length) {
      return segment.text.replace(/\n/g, '\\N')
    }

    let result = withGlow ? '{\\blur2}' : ''

    for (let i = 0; i < segment.words.length; i++) {
      const word = segment.words[i]
      if (!word) continue

      // \kf em centissegundos
      const durationCs = Math.round(word.durationMs / 10)
      result += `{\\kf${durationCs}}${word.text}`

      if (i < segment.words.length - 1) {
        result += ' '
      }
    }

    return result
  }

  // =========================================================================
  //  FFmpeg Application
  // =========================================================================

  /**
   * Aplica apenas a logo no rodapé direito (sem legendas).
   * Usado quando o usuário escolhe "incluir logo" mas não "incluir legendas".
   */
  async applyLogoOnly(videoBuffer: Buffer): Promise<Buffer> {
    const logoPath = getFooterLogoPath()
    if (!logoPath) {
      const log = createPipelineLogger({ stage: 'Captions' })
      log.info('Nenhuma logo em public; retornando vídeo inalterado.')
      return videoBuffer
    }
    return this.applyLogoOverlay(videoBuffer, null)
  }

  // =========================================================================
  //  Path-based variants (para vídeos grandes — sem carregar em memória)
  // =========================================================================

  /**
   * Aplica legendas + logo direto em disco (input path → output path).
   * Não carrega o vídeo em memória — ideal para vídeos > 200MB.
   */
  async addCaptionsFromScenesOnDisk(
    inputVideoPath: string,
    outputVideoPath: string,
    scenes: SceneCaptionData[],
    options: CaptionOptions = {}
  ): Promise<{ styleUsed: CaptionStyleId; scenesProcessed: number }> {
    const log = createPipelineLogger({ stage: 'Captions' })
    const { styleId = 'tiktok_viral' } = options
    const style = CAPTION_STYLES[styleId]

    log.info(`[OnDisk] Gerando legendas a partir de ${scenes.length} cenas.`)
    log.info(`[OnDisk] Estilo: ${style.name} (${style.effect}).`)

    const scenesWithRealDuration = await this.resolveRealDurations(scenes)
    const segments = this.buildSegmentsFromScenes(scenesWithRealDuration, style)
    log.info(`[OnDisk] ${segments.length} segmentos de legenda gerados.`)

    const assContent = this.generateASS(segments, style)
    await this.applyLogoOverlayOnDisk(inputVideoPath, outputVideoPath, assContent)
    log.info('[OnDisk] Legendas aplicadas com sucesso.')

    return { styleUsed: styleId, scenesProcessed: scenes.length }
  }

  /**
   * Aplica apenas logo direto em disco (input path → output path).
   * Não carrega o vídeo em memória.
   */
  async applyLogoOnlyOnDisk(inputVideoPath: string, outputVideoPath: string): Promise<boolean> {
    const logoPath = getFooterLogoPath()
    if (!logoPath) {
      const log = createPipelineLogger({ stage: 'Captions' })
      log.info('[OnDisk] Nenhuma logo em public; copiando vídeo inalterado.')
      await fs.copyFile(inputVideoPath, outputVideoPath)
      return false
    }
    await this.applyLogoOverlayOnDisk(inputVideoPath, outputVideoPath, null)
    return true
  }

  /**
   * Versão on-disk do applyLogoOverlay — trabalha apenas com paths, sem buffers.
   */
  private async applyLogoOverlayOnDisk(
    inputVideoPath: string,
    outputVideoPath: string,
    assContent: string | null
  ): Promise<void> {
    const tempDir = tmpdir()
    const ts = Date.now()
    const assPath = join(tempDir, `caption-subs-${ts}.ass`)
    const ffmpegPath = getFFmpegPath()
    const logoPath = getFooterLogoPath()

    try {
      if (assContent) await fs.writeFile(assPath, assContent, 'utf-8')

      const forwardSlashAss = assPath.replace(/\\/g, '/')
      const escapedAssPath = forwardSlashAss.replace(/:/g, '\\\\:')

      const captLog = createPipelineLogger({ stage: 'Captions' })
      if (logoPath) {
        if (assContent) {
          captLog.info('[OnDisk] Aplicando legendas + logo no rodapé direito (FFmpeg).')
          const filterComplex =
            `[0:v]ass=${escapedAssPath}[sub];[1:v]scale=-1:160,format=rgba,colorchannelmixer=aa=0.5[logo];[sub][logo]overlay=main_w-overlay_w-24:main_h-overlay_h-24[v]`
          await new Promise<void>((resolve, reject) => {
            const proc = spawn(ffmpegPath, [
              '-i', inputVideoPath, '-i', logoPath,
              '-filter_complex', filterComplex, '-map', '[v]', '-map', '0:a',
              '-c:a', 'copy', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-y', outputVideoPath
            ])
            this.attachFFmpegHandlers(proc, resolve, reject)
          })
        } else {
          captLog.info('[OnDisk] Aplicando apenas logo no rodapé direito (FFmpeg).')
          const filterComplex =
            `[1:v]scale=-1:160,format=rgba,colorchannelmixer=aa=0.5[logo];[0:v][logo]overlay=main_w-overlay_w-24:main_h-overlay_h-24[v]`
          await new Promise<void>((resolve, reject) => {
            const proc = spawn(ffmpegPath, [
              '-i', inputVideoPath, '-i', logoPath,
              '-filter_complex', filterComplex, '-map', '[v]', '-map', '0:a',
              '-c:a', 'copy', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-y', outputVideoPath
            ])
            this.attachFFmpegHandlers(proc, resolve, reject)
          })
        }
      } else {
        if (assContent) {
          captLog.info('[OnDisk] Aplicando legendas com FFmpeg (ASS).')
          await new Promise<void>((resolve, reject) => {
            const proc = spawn(ffmpegPath, [
              '-i', inputVideoPath, '-vf', `ass=${escapedAssPath}`,
              '-c:a', 'copy', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-y', outputVideoPath
            ])
            this.attachFFmpegHandlers(proc, resolve, reject)
          })
        } else {
          await fs.copyFile(inputVideoPath, outputVideoPath)
        }
      }
    } finally {
      await fs.unlink(assPath).catch(() => { })
    }
  }

  /**
   * Overlay da logo no vídeo. Se assContent for fornecido, aplica legendas antes da logo.
   */
  private async applyLogoOverlay(videoBuffer: Buffer, assContent: string | null): Promise<Buffer> {
    const tempDir = tmpdir()
    const ts = Date.now()
    const inputPath = join(tempDir, `caption-input-${ts}.mp4`)
    const assPath = join(tempDir, `caption-subs-${ts}.ass`)
    const outputPath = join(tempDir, `caption-output-${ts}.mp4`)
    const ffmpegPath = getFFmpegPath()
    const logoPath = getFooterLogoPath()

    try {
      await fs.writeFile(inputPath, videoBuffer)
      if (assContent) await fs.writeFile(assPath, assContent, 'utf-8')

      const forwardSlashAss = assPath.replace(/\\/g, '/')
      const escapedAssPath = forwardSlashAss.replace(/:/g, '\\\\:')

      const captLog = createPipelineLogger({ stage: 'Captions' })
      if (logoPath) {
        if (assContent) {
          captLog.info('Aplicando legendas + logo no rodapé direito (FFmpeg).')
          const filterComplex =
            `[0:v]ass=${escapedAssPath}[sub];[1:v]scale=-1:160,format=rgba,colorchannelmixer=aa=0.5[logo];[sub][logo]overlay=main_w-overlay_w-24:main_h-overlay_h-24[v]`
          await new Promise<void>((resolve, reject) => {
            const proc = spawn(ffmpegPath, [
              '-i', inputPath, '-i', logoPath,
              '-filter_complex', filterComplex, '-map', '[v]', '-map', '0:a',
              '-c:a', 'copy', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-y', outputPath
            ])
            this.attachFFmpegHandlers(proc, resolve, reject)
          })
        } else {
          captLog.info('Aplicando apenas logo no rodapé direito (FFmpeg).')
          const filterComplex =
            `[1:v]scale=-1:160,format=rgba,colorchannelmixer=aa=0.5[logo];[0:v][logo]overlay=main_w-overlay_w-24:main_h-overlay_h-24[v]`
          await new Promise<void>((resolve, reject) => {
            const proc = spawn(ffmpegPath, [
              '-i', inputPath, '-i', logoPath,
              '-filter_complex', filterComplex, '-map', '[v]', '-map', '0:a',
              '-c:a', 'copy', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-y', outputPath
            ])
            this.attachFFmpegHandlers(proc, resolve, reject)
          })
        }
      } else {
        if (assContent) {
          captLog.info('Aplicando legendas com FFmpeg (ASS).')
          await new Promise<void>((resolve, reject) => {
            const proc = spawn(ffmpegPath, [
              '-i', inputPath, '-vf', `ass=${escapedAssPath}`,
              '-c:a', 'copy', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-y', outputPath
            ])
            this.attachFFmpegHandlers(proc, resolve, reject)
          })
        } else {
          await fs.unlink(inputPath).catch(() => { })
          return videoBuffer
        }
      }

      const outBuffer = await fs.readFile(outputPath)
      await fs.unlink(inputPath).catch(() => { })
      await fs.unlink(assPath).catch(() => { })
      await fs.unlink(outputPath).catch(() => { })
      return outBuffer
    } catch (error) {
      await fs.unlink(inputPath).catch(() => { })
      await fs.unlink(assPath).catch(() => { })
      await fs.unlink(outputPath).catch(() => { })

      throw new Error(`Falha ao aplicar legendas/logo: ${error}`)
    }
  }

  /** Aplica arquivo ASS ao vídeo via FFmpeg; usa applyLogoOverlay com ASS. */
  private async applyASSToVideo(videoBuffer: Buffer, assContent: string): Promise<Buffer> {
    return this.applyLogoOverlay(videoBuffer, assContent)
  }

  private attachFFmpegHandlers(
    proc: ReturnType<typeof spawn>,
    resolve: () => void,
    reject: (err: Error) => void
  ): void {
    let stderrOutput = ''
    proc.stderr?.on('data', (data: Buffer) => {
      const line = data.toString()
      stderrOutput += line
      if (line.includes('Error') || line.includes('error') || line.includes('Stream') || line.includes('Duration')) {
        const log = createPipelineLogger({ stage: 'Captions' })
        log.step('FFmpeg', line.trim())
      }
    })
    proc.on('close', (code: number | null) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg saiu com código ${code}: ${stderrOutput.slice(-500)}`))
    })
    proc.on('error', (err: Error) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`))
    })
  }

  // =========================================================================
  //  Duration Resolution (ffprobe)
  // =========================================================================

  /**
   * Resolve a duração REAL dos áudios das cenas via ffprobe.
   * 
   * O banco armazena uma estimativa (wordCount / WPM * 60) que é imprecisa.
   * O vídeo é renderizado com a duração real (via ffprobe), então as legendas
   * também precisam usar a duração real para ficarem sincronizadas.
   * 
   * Se o audioFileData não estiver disponível, mantém a duração estimada (fallback).
   */
  private async resolveRealDurations(scenes: SceneCaptionData[]): Promise<SceneCaptionData[]> {
    const resolved: SceneCaptionData[] = []

    for (const scene of scenes) {
      if (scene.audioFileData && scene.audioFileData.length > 0) {
        try {
          const realDuration = await this.probeAudioDuration(scene.audioFileData)
          const diff = Math.abs(realDuration - scene.audioDuration)

          if (diff > 0.5) {
            const log = createPipelineLogger({ stage: 'Captions' })
            log.step(`Cena ${scene.order + 1}`, `duração ${scene.audioDuration.toFixed(2)}s → ${realDuration.toFixed(2)}s (diff ${diff.toFixed(2)}s)`)
          }

          resolved.push({
            ...scene,
            audioDuration: realDuration
          })
        } catch (err) {
          const log = createPipelineLogger({ stage: 'Captions' })
          log.warn(`Cena ${scene.order + 1}: ffprobe falhou; usando estimativa ${scene.audioDuration.toFixed(2)}s.`)
          resolved.push(scene)
        }
      } else {
        resolved.push(scene)
      }
    }

    return resolved
  }

  /**
   * Extrai a duração real de um buffer de áudio usando ffprobe
   */
  private async probeAudioDuration(audioBuffer: Buffer): Promise<number> {
    const tempPath = join(tmpdir(), `caption-probe-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`)

    try {
      await fs.writeFile(tempPath, audioBuffer)

      const ffprobePath = this.getFFprobePath()

      const duration = await new Promise<number>((resolve, reject) => {
        const proc = spawn(ffprobePath, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          tempPath
        ])

        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
        proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

        proc.on('close', (code: number | null) => {
          if (code !== 0) {
            return reject(new Error(`ffprobe exit code ${code}: ${stderr}`))
          }

          try {
            const parsed = JSON.parse(stdout)
            const dur = parseFloat(parsed?.format?.duration)
            if (isNaN(dur) || dur <= 0) {
              return reject(new Error('ffprobe retornou duração inválida'))
            }
            resolve(dur)
          } catch (e) {
            reject(new Error(`Erro ao parsear saída do ffprobe: ${e}`))
          }
        })

        proc.on('error', (err: Error) => {
          reject(new Error(`ffprobe spawn error: ${err.message}`))
        })
      })

      return duration
    } finally {
      await fs.unlink(tempPath).catch(() => { })
    }
  }

  /** Retorna o caminho do ffprobe via @ffprobe-installer */
  private getFFprobePath(): string {
    return ffprobeInstaller.path
  }

  // =========================================================================
  //  Utilities
  // =========================================================================


  /** Formata tempo em segundos para formato ASS (H:MM:SS.cc) */
  private formatASSTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const cs = Math.floor((seconds % 1) * 100)

    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
  }

  /** Formata tempo em segundos para formato SRT (HH:MM:SS,mmm) */
  private formatSRTTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
  }

  /** Formata tempo em segundos para formato VTT (HH:MM:SS.mmm) */
  private formatVTTTime(seconds: number): string {
    return this.formatSRTTime(seconds).replace(',', '.')
  }

  // =========================================================================
  //  Subtitle Export (SRT / VTT)
  // =========================================================================

  /**
   * Exporta legendas no formato SRT com timestamps precisos.
   * Usa a mesma lógica de segmentação do ASS (word timings do ElevenLabs).
   * 
   * Se actualVideoDuration for fornecida, escala TODOS os timestamps
   * proporcionalmente para alinhar com a duração real do vídeo renderizado.
   * Isso elimina qualquer drift causado por frame grid, AAC padding,
   * re-encoding na concatenação, etc.
   * 
   * Formato SRT (aceito pelo YouTube, Vimeo, etc):
   *   1
   *   00:00:01,200 --> 00:00:03,800
   *   Texto da legenda
   */
  async exportSRT(
    scenes: SceneCaptionData[],
    options: SubtitleExportOptions = {}
  ): Promise<string> {
    const { styleId = 'tiktok_viral', actualVideoDuration } = options
    const style = CAPTION_STYLES[styleId]

    const scenesWithRealDuration = await this.resolveRealDurations(scenes)
    const segments = this.buildSegmentsFromScenes(scenesWithRealDuration, style)

    // Escalar timestamps para alinhar com a duração real do vídeo
    const scaled = this.scaleSegmentsToVideoDuration(segments, scenesWithRealDuration, actualVideoDuration)

    const lines: string[] = []
    for (let i = 0; i < scaled.length; i++) {
      const seg = scaled[i]!
      lines.push(`${i + 1}`)
      lines.push(`${this.formatSRTTime(seg.startTime)} --> ${this.formatSRTTime(seg.endTime)}`)
      lines.push(seg.text)
      lines.push('')
    }

    return lines.join('\n')
  }

  /**
   * Exporta legendas no formato WebVTT com timestamps precisos.
   * YouTube e navegadores modernos suportam nativamente.
   * 
   * Formato VTT:
   *   WEBVTT
   *   
   *   00:00:01.200 --> 00:00:03.800
   *   Texto da legenda
   */
  async exportVTT(
    scenes: SceneCaptionData[],
    options: SubtitleExportOptions = {}
  ): Promise<string> {
    const { styleId = 'tiktok_viral', actualVideoDuration } = options
    const style = CAPTION_STYLES[styleId]

    const scenesWithRealDuration = await this.resolveRealDurations(scenes)
    const segments = this.buildSegmentsFromScenes(scenesWithRealDuration, style)

    // Escalar timestamps para alinhar com a duração real do vídeo
    const scaled = this.scaleSegmentsToVideoDuration(segments, scenesWithRealDuration, actualVideoDuration)

    const lines: string[] = ['WEBVTT', '']
    for (let i = 0; i < scaled.length; i++) {
      const seg = scaled[i]!
      lines.push(`${i + 1}`)
      lines.push(`${this.formatVTTTime(seg.startTime)} --> ${this.formatVTTTime(seg.endTime)}`)
      lines.push(seg.text)
      lines.push('')
    }

    return lines.join('\n')
  }

  // =========================================================================
  //  Timeline Scaling (Anti-Drift)
  // =========================================================================

  /**
   * Escala segmentos de legenda para alinhar com a duração real do vídeo.
   * 
   * O vídeo renderizado pode ter duração ligeiramente diferente da soma
   * dos áudios por causa de: frame grid quantization (16fps = 62.5ms por frame),
   * AAC encoder padding (~46ms por cena), re-encoding na concatenação, etc.
   * 
   * Em vez de tentar prever cada fonte de erro, medimos a duração real
   * e escalamos TUDO proporcionalmente. Simples, robusto, definitivo.
   * 
   * Exemplo: sum_audio=300.0s, video_real=299.2s → scale=0.99733
   *          Todos timestamps *= 0.99733 → drift ZERO.
   */
  private scaleSegmentsToVideoDuration(
    segments: CaptionSegment[],
    scenes: SceneCaptionData[],
    actualVideoDuration?: number
  ): CaptionSegment[] {
    if (!actualVideoDuration || actualVideoDuration <= 0) return segments
    if (segments.length === 0) return segments

    // Duração total esperada = soma das durações dos áudios
    const expectedTotal = scenes.reduce((sum, s) => sum + s.audioDuration, 0)
    if (expectedTotal <= 0) return segments

    const scaleFactor = actualVideoDuration / expectedTotal
    const diff = Math.abs(actualVideoDuration - expectedTotal)

    const log = createPipelineLogger({ stage: 'Captions' })
    log.info(`[Subtitle Scaling] Duração esperada: ${expectedTotal.toFixed(3)}s, Vídeo real: ${actualVideoDuration.toFixed(3)}s, Diff: ${diff.toFixed(3)}s, Scale: ${scaleFactor.toFixed(6)}`)

    // Se a diferença é negligenciável (< 50ms), não escalar
    if (diff < 0.05) {
      log.info('[Subtitle Scaling] Diferença < 50ms; sem necessidade de escalar.')
      return segments
    }

    return segments.map(seg => ({
      ...seg,
      startTime: seg.startTime * scaleFactor,
      endTime: seg.endTime * scaleFactor,
      words: seg.words.map(w => ({
        ...w,
        startMs: Math.round(w.startMs * scaleFactor),
        durationMs: Math.round(w.durationMs * scaleFactor)
      }))
    }))
  }

  /**
   * Proba a duração real de um vídeo a partir de Buffer ou path em disco.
   * Usado pelo endpoint de export de legendas para obter o scaleFactor.
   */
  async probeVideoDuration(source: { buffer?: Buffer; path?: string }): Promise<number> {
    let tempPath: string | null = null

    try {
      const filePath = source.path ?? (() => {
        tempPath = join(tmpdir(), `subtitle-probe-${Date.now()}.mp4`)
        return tempPath
      })()

      if (source.buffer && !source.path) {
        await fs.writeFile(filePath, source.buffer)
      }

      const ffprobePath = this.getFFprobePath()

      return await new Promise<number>((resolve, reject) => {
        const proc = spawn(ffprobePath, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          filePath
        ])

        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
        proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

        proc.on('close', (code: number | null) => {
          if (code !== 0) return reject(new Error(`ffprobe video exit code ${code}: ${stderr}`))
          try {
            const parsed = JSON.parse(stdout)
            const dur = parseFloat(parsed?.format?.duration)
            if (isNaN(dur) || dur <= 0) return reject(new Error('ffprobe retornou duração de vídeo inválida'))
            resolve(dur)
          } catch (e) {
            reject(new Error(`Erro ao parsear duração do vídeo: ${e}`))
          }
        })

        proc.on('error', (err: Error) => reject(new Error(`ffprobe video spawn error: ${err.message}`)))
      })
    } finally {
      if (tempPath) await fs.unlink(tempPath).catch(() => { })
    }
  }
}

// ---------------------------------------------------------------------------
//  Internal types
// ---------------------------------------------------------------------------

interface WordTiming {
  text: string
  startMs: number       // Offset relativo ao início do segmento
  durationMs: number
}

interface CaptionSegment {
  text: string
  startTime: number     // Offset absoluto em segundos
  endTime: number       // Offset absoluto em segundos
  words: WordTiming[]   // Timing por palavra (quando necessário)
}
