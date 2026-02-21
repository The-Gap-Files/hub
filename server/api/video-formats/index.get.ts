import { VIDEO_FORMATS } from '../../constants/distribution/video-formats'

export default defineEventHandler(() => {
  return {
    data: Object.values(VIDEO_FORMATS)
  }
})
