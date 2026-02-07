import { VIDEO_FORMATS } from '../../constants/video-formats'

export default defineEventHandler(() => {
  return {
    data: Object.values(VIDEO_FORMATS)
  }
})
