import { getScriptStylesList } from '../../constants/script-styles'

export default defineEventHandler(() => {
  const styles = getScriptStylesList()
  return {
    styles: styles.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description
    }))
  }
})
