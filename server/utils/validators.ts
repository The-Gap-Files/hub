/**
 * Toggle global para validadores LLM (monetização, story outline, script).
 *
 * TEMPORÁRIO: default é DESABILITADO para evitar custo/latência e loops de repair.
 *
 * Para reativar (quando quiser):
 * - ANTIGRAVITY_VALIDATORS=1
 * - ANTIGRAVITY_VALIDATORS=true
 * - ANTIGRAVITY_VALIDATORS=enabled
 */
export function validatorsEnabled(): boolean {
  const raw = String(process.env.ANTIGRAVITY_VALIDATORS || '').trim().toLowerCase()
  if (raw === '1' || raw === 'true' || raw === 'enabled') return true
  if (raw === '0' || raw === 'false' || raw === 'disabled') return false

  // Default temporário: DESLIGADO
  return false
}

