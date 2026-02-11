/**
 * Plugin de inicialização dos provedores de IA
 * 
 * Inicializa a Media Factory (providers de mídia) no boot do server.
 * O Script Provider é resolvido dinamicamente via LLM Factory (banco de dados)
 * a cada chamada, não precisa mais de configuração estática.
 */

import { initMediaFactory } from '../services/media/media-factory'
import { initAssignments } from '../services/llm/llm-factory'

export default defineNitroPlugin(async () => {
  // ═══ 1. Inicializar LLM Factory (seed providers/models/assignments no banco) ═══
  try {
    await initAssignments()
    console.log('[TheGapFiles] ✅ LLM Factory initialized (seed → DB)')
  } catch (err) {
    console.error('[TheGapFiles] ⚠️ LLM Factory initialization failed:', err)
  }

  // ═══ 2. Inicializar Media Factory (seed + providers de mídia do banco) ═══
  try {
    await initMediaFactory()
    console.log('[TheGapFiles] ✅ Media Factory initialized (DB)')
  } catch (err) {
    console.error('[TheGapFiles] ⚠️ Media Factory initialization failed, env fallback will be used:', err)
  }

  console.log('[TheGapFiles] All providers managed by LLM Factory + Media Factory (DB-driven).')
})
