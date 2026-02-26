/**
 * Wrapper for confirmation dialogs.
 *
 * Currently uses native `confirm()` — will be replaced by a proper
 * modal dialog component in a later refactoring phase.
 */
export function confirmAction(message: string): boolean {
  return confirm(message)
}
