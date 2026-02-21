/**
 * GET /api/constants/narrative-roles
 *
 * Bridge: expõe os papéis narrativos (server/constants) para o client-side.
 * Single source of truth: server/constants/content/narrative-roles.ts
 */
import { NARRATIVE_ROLES } from '../../constants/content/narrative-roles'

export default defineEventHandler(() => {
  return NARRATIVE_ROLES.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    icon: r.icon
  }))
})
