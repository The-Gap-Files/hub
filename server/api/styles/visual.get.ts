import { getVisualStylesList } from '../../constants/cinematography/visual-styles'

export default defineEventHandler(() => {
  const styles = getVisualStylesList()
  return {
    styles: styles.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description
    }))
  }
})
