/**
 * Video Store - Gerenciamento de estado dos vídeos
 */

import { defineStore } from 'pinia'

export interface Video {
  id: string
  title: string
  theme: string
  status: string
  visualStyle?: string
  duration?: number
  language: string
  thumbnailPath?: string
  createdAt: string
  updatedAt: string
  outputPath?: string
  completedAt?: string
}

export type VideoStatus =
  | 'PENDING'
  | 'SCRIPT_GENERATING'
  | 'SCRIPT_READY'
  | 'AUDIO_GENERATING'
  | 'AUDIO_READY'
  | 'IMAGES_GENERATING'
  | 'IMAGES_READY'
  | 'RENDERING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface VideoState {
  videos: Video[]
  currentVideo: Video | null
  loading: boolean
  error: string | null
  pagination: PaginationInfo
  filters: {
    status?: VideoStatus
    search?: string
  }
}

export const useVideoStore = defineStore('videos', {
  state: (): VideoState => ({
    videos: [],
    currentVideo: null,
    loading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0
    },
    filters: {}
  }),

  getters: {
    pendingVideos: (state) => state.videos.filter(v => v.status === 'PENDING'),
    processingVideos: (state) => state.videos.filter(v =>
      !['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(v.status)
    ),
    completedVideos: (state) => state.videos.filter(v => v.status === 'COMPLETED'),
    failedVideos: (state) => state.videos.filter(v => v.status === 'FAILED')
  },

  actions: {
    async fetchVideos(page = 1) {
      this.loading = true
      this.error = null

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: this.pagination.limit.toString(),
          ...(this.filters.status && { status: this.filters.status }),
          ...(this.filters.search && { search: this.filters.search })
        })

        const response = await $fetch<{
          success: boolean
          data: Video[]
          pagination: PaginationInfo
        }>(`/api/videos?${params}`)

        this.videos = response.data
        this.pagination = response.pagination
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erro ao carregar vídeos'
      } finally {
        this.loading = false
      }
    },

    async fetchVideo(id: string) {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch<{
          success: boolean
          data: Video
        }>(`/api/videos/${id}`)

        this.currentVideo = response.data
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erro ao carregar vídeo'
      } finally {
        this.loading = false
      }
    },

    async createVideo(theme: string, options: Partial<{
      language: string
      targetDuration: number
      style: string // Agora aceita ID do estilo de roteiro do banco
      voiceId: string
      imageStyle: 'cinematic' | 'photorealistic' | 'artistic' | 'documentary'
      visualStyle: string
      aspectRatio: '9:16' | '16:9'
      enableMotion: boolean
      mustInclude: string
      mustExclude: string
    }> = {}) {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch<{
          success: boolean
          data: { id: string; status: string }
        }>('/api/videos', {
          method: 'POST',
          body: { theme, ...options }
        })

        // Recarregar lista
        await this.fetchVideos(1)

        return response.data
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erro ao criar vídeo'
        throw error
      } finally {
        this.loading = false
      }
    },

    setFilter(key: 'status' | 'search', value: string | undefined) {
      this.filters[key] = value as VideoStatus | undefined
      this.fetchVideos(1)
    },

    clearFilters() {
      this.filters = {}
      this.fetchVideos(1)
    }
  }
})
