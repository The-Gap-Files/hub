/**
 * IMPLEMENTAÇÃO: Ajuste Dinâmico de Velocidade de Vídeo para Sincronização com Áudio
 * 
 * PROBLEMA:
 * - Vídeos gerados têm 5s fixos
 * - Áudio das cenas varia (4.5s, 6.2s, etc.)
 * - Sistema atual usa loop (-stream_loop -1) que causa "pulos"
 * 
 * SOLUÇÃO:
 * - Calcular fator de velocidade necessário
 * - Aplicar filtro setpts do FFmpeg para desacelerar/acelerar suavemente
 * - Limitar entre 0.5x e 1.5x para evitar distorções
 */

// ============================================================================
// PARTE 1: Modificar inputs (linha ~944)
// ============================================================================

// ANTES:
/*
        // Adicionar cada asset como um input com loop/stream e duração real baseada no áudio
        scenes.forEach((scene, index) => {
          const videoClip = scene.videos[0]
          const image = scene.images[0]

          let duration = (scene.endTime && scene.startTime !== null)
            ? (scene.endTime - scene.startTime)
            : (totalAudioDuration / scenes.length)

          if (index === scenes.length - 1) {
            duration += 0.5
          }

          if (videoClip && scenePaths[index]) {
            command.input(scenePaths[index]!)
              .inputOptions(['-stream_loop -1', `-t ${duration}`])  // ❌ LOOP
          } else if (image && scenePaths[index]) {
            command.input(scenePaths[index]!)
              .inputOptions(['-loop 1', `-t ${duration}`])
          }
        })
*/

// DEPOIS:
const sceneMetadata: Array<{ duration: number; videoClipDuration?: number; isVideo: boolean }> = []

scenes.forEach((scene, index) => {
  const videoClip = scene.videos[0]
  const image = scene.images[0]

  let duration = (scene.endTime && scene.startTime !== null)
    ? (scene.endTime - scene.startTime)
    : (totalAudioDuration / scenes.length)

  if (index === scenes.length - 1) {
    duration += 0.5
  }

  if (videoClip && scenePaths[index]) {
    // Armazenar duração original do vídeo
    const videoClipDuration = videoClip.duration || 5
    sceneMetadata.push({ duration, videoClipDuration, isVideo: true })

    // ✅ SEM LOOP - vamos ajustar velocidade depois
    command.input(scenePaths[index]!)
  } else if (image && scenePaths[index]) {
    sceneMetadata.push({ duration, isVideo: false })
    command.input(scenePaths[index]!)
      .inputOptions(['-loop 1', `-t ${duration}`])
  }
})

// ============================================================================
// PARTE 2: Modificar complexFilter (linha ~979)
// ============================================================================

// ANTES:
/*
        command
          .complexFilter([
            // 1. Escalar imagens
            ...scenes.map((_, i) => ({
              filter: 'scale',
              options: isPortrait ? '768:1344:...' : '1344:768:...',
              inputs: `${i}:v`,
              outputs: `scaled_${i}`
            })),
            // 2. Concatenar
            { filter: 'concat', ... },
            // 3. Format
            { filter: 'format', ... }
          ])
*/

// DEPOIS:
command
  .complexFilter([
    // 1. NOVO: Ajustar velocidade dos vídeos
    ...scenes.map((_, i) => {
      const metadata = sceneMetadata[i]
      const filters: any[] = []

      if (metadata.isVideo && metadata.videoClipDuration) {
        // Calcular fator de velocidade
        const speedFactor = metadata.videoClipDuration / metadata.duration

        if (speedFactor > 1.05) {
          // Vídeo mais longo que áudio → acelerar (máx 1.5x)
          const clampedSpeed = Math.min(speedFactor, 1.5)
          filters.push({
            filter: 'setpts',
            options: `${1 / clampedSpeed}*PTS`,
            inputs: `${i}:v`,
            outputs: `adjusted_${i}`
          })
        } else if (speedFactor < 0.95) {
          // Vídeo mais curto que áudio → desacelerar (mín 0.5x)
          const clampedSpeed = Math.max(speedFactor, 0.5)
          filters.push({
            filter: 'setpts',
            options: `${1 / clampedSpeed}*PTS`,
            inputs: `${i}:v`,
            outputs: `adjusted_${i}`
          })
        } else {
          // Diferença mínima → não ajustar
          filters.push({
            filter: 'null',
            inputs: `${i}:v`,
            outputs: `adjusted_${i}`
          })
        }

        // Trim para duração exata
        filters.push({
          filter: 'trim',
          options: { duration: metadata.duration },
          inputs: `adjusted_${i}`,
          outputs: `trimmed_${i}`
        })

        // Resetar PTS após trim
        filters.push({
          filter: 'setpts',
          options: 'PTS-STARTPTS',
          inputs: `trimmed_${i}`,
          outputs: `final_${i}`
        })
      } else {
        // Imagens → passar adiante
        filters.push({
          filter: 'null',
          inputs: `${i}:v`,
          outputs: `final_${i}`
        })
      }

      return filters
    }).flat(),

    // 2. Escalar para tamanho uniforme
    ...scenes.map((_, i) => ({
      filter: 'scale',
      options: isPortrait
        ? '768:1344:force_original_aspect_ratio=increase,crop=768:1344,pad=768:1344:(ow-iw)/2:(oh-ih)/2'
        : '1344:768:force_original_aspect_ratio=increase,crop=1344:768,pad=1344:768:(ow-iw)/2:(oh-ih)/2',
      inputs: `final_${i}`,  // ✅ MUDOU: era `${i}:v`
      outputs: `scaled_${i}`
    })),

    // 3. Concatenar
    {
      filter: 'concat',
      options: { n: scenes.length, v: 1, a: 0 },
      inputs: scenes.map((_, i) => `scaled_${i}`),
      outputs: 'v'
    },

    // 4. Format
    {
      filter: 'format',
      options: 'yuv420p',
      inputs: 'v',
      outputs: 'final_v'
    }
  ])

// ============================================================================
// EXEMPLO DE USO
// ============================================================================

/*
CENÁRIO 1: Vídeo mais curto que áudio
- Vídeo: 5.0s
- Áudio: 6.2s
- Speed Factor: 5.0 / 6.2 = 0.806
- Ação: Desacelerar para 0.806x (dentro do limite 0.5x-1.5x)
- Resultado: Vídeo esticado suavemente para 6.2s

CENÁRIO 2: Vídeo mais longo que áudio
- Vídeo: 5.0s
- Áudio: 4.5s
- Speed Factor: 5.0 / 4.5 = 1.111
- Ação: Acelerar para 1.111x
- Resultado: Vídeo comprimido suavemente para 4.5s

CENÁRIO 3: Diferença mínima
- Vídeo: 5.0s
- Áudio: 5.1s
- Speed Factor: 5.0 / 5.1 = 0.980 (entre 0.95 e 1.05)
- Ação: Não ajustar (diferença imperceptível)
- Resultado: Usa duração original
*/
