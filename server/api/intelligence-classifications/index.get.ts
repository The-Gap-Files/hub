import { INTELLIGENCE_CLASSIFICATIONS } from '../../constants/intelligence-classifications'

export default defineEventHandler(() => {
  return {
    data: Object.values(INTELLIGENCE_CLASSIFICATIONS)
  }
})
