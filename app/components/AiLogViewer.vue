<template>
  <!-- Floating Toggle Button -->
  <button
    id="ai-log-toggle"
    class="ai-log-fab"
    :class="{ 'has-activity': hasRecentActivity, 'is-open': isOpen }"
    @click="toggle"
    title="Terminal IA"
  >
    <Terminal :size="20" />
    <span v-if="unreadCount > 0 && !isOpen" class="unread-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
  </button>

  <!-- Lightbox Overlay -->
  <Teleport to="body">
    <Transition name="lightbox">
      <div v-if="isOpen" class="ai-log-overlay" @click.self="close">
        <div class="ai-log-panel">
          <!-- Header -->
          <div class="ai-log-header">
            <div class="header-left">
              <div class="header-dot red"></div>
              <div class="header-dot yellow"></div>
              <div class="header-dot green"></div>
              <span class="header-title">Terminal IA — Live Stream</span>
            </div>
            <div class="header-right">
              <span class="connection-status" :class="connected ? 'online' : 'offline'">
                {{ connected ? '● LIVE' : '○ OFFLINE' }}
              </span>
              <span class="log-count">{{ logs.length }} linhas</span>
              <button class="header-btn" @click="clearLogs" title="Limpar">
                <Trash2 :size="14" />
              </button>
              <button class="header-btn" @click="scrollToBottom" title="Ir ao final">
                <ArrowDownToLine :size="14" />
              </button>
              <button class="header-btn close-btn" @click="close" title="Fechar">
                <X :size="16" />
              </button>
            </div>
          </div>

          <!-- Terminal Body -->
          <div
            ref="terminalRef"
            class="ai-log-body"
            @scroll="onScroll"
          >
            <div
              v-for="entry in logs"
              :key="entry.id"
              class="log-line"
              :class="getLineClass(entry)"
            >
              <span class="log-time">{{ formatTime(entry.timestamp) }}</span>
              <span class="log-message" v-html="colorize(entry.message)"></span>
            </div>

            <div v-if="logs.length === 0" class="log-empty">
              <Terminal :size="32" class="opacity-20" />
              <p>Aguardando operações de IA...</p>
              <p class="text-xs opacity-40">Os logs aparecerão aqui em tempo real</p>
            </div>
          </div>

          <!-- Auto-scroll indicator -->
          <div v-if="!autoScroll && logs.length > 0" class="scroll-indicator" @click="scrollToBottom">
            <ArrowDownToLine :size="12" />
            <span>Novas linhas disponíveis</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Terminal, Trash2, ArrowDownToLine, X } from 'lucide-vue-next'

interface LogEntry {
  id: string
  timestamp: string
  level: 'stdout' | 'stderr'
  message: string
}

// State
const isOpen = ref(false)
const connected = ref(false)
const logs = ref<LogEntry[]>([])
const unreadCount = ref(0)
const hasRecentActivity = ref(false)
const autoScroll = ref(true)
const terminalRef = ref<HTMLElement | null>(null)

let eventSource: EventSource | null = null
let activityTimeout: ReturnType<typeof setTimeout> | null = null

// Max logs para não estourar memória
const MAX_LOGS = 2000

// =============================================================================
// SSE Connection
// =============================================================================

function connect() {
  if (eventSource) return

  eventSource = new EventSource('/api/ai-logs/stream')

  eventSource.onopen = () => {
    connected.value = true
  }

  eventSource.onmessage = (event) => {
    try {
      const entry: LogEntry = JSON.parse(event.data)
      addLog(entry)
    } catch { /* ignore parse errors */ }
  }

  eventSource.onerror = () => {
    connected.value = false
    // Reconectar após 3 segundos
    setTimeout(() => {
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
      connect()
    }, 3000)
  }
}

function disconnect() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
    connected.value = false
  }
}

function addLog(entry: LogEntry) {
  logs.value.push(entry)

  // Limitar tamanho
  if (logs.value.length > MAX_LOGS) {
    logs.value = logs.value.slice(-MAX_LOGS)
  }

  // Unread counter (se lightbox fechada)
  if (!isOpen.value) {
    unreadCount.value++
  }

  // Indicador de atividade recente
  hasRecentActivity.value = true
  if (activityTimeout) clearTimeout(activityTimeout)
  activityTimeout = setTimeout(() => {
    hasRecentActivity.value = false
  }, 2000)

  // Auto-scroll
  if (autoScroll.value && terminalRef.value) {
    nextTick(() => {
      if (terminalRef.value) {
        terminalRef.value.scrollTop = terminalRef.value.scrollHeight
      }
    })
  }
}

// =============================================================================
// UI Actions
// =============================================================================

function toggle() {
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

function open() {
  isOpen.value = true
  unreadCount.value = 0
  autoScroll.value = true
  if (!eventSource) connect()
  nextTick(() => scrollToBottom())
}

function close() {
  isOpen.value = false
}

function clearLogs() {
  logs.value = []
}

function scrollToBottom() {
  autoScroll.value = true
  nextTick(() => {
    if (terminalRef.value) {
      terminalRef.value.scrollTop = terminalRef.value.scrollHeight
    }
  })
}

function onScroll() {
  if (!terminalRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = terminalRef.value
  // Se o usuário scrollou para cima (mais de 100px do final), desliga auto-scroll
  autoScroll.value = scrollHeight - scrollTop - clientHeight < 100
}

// =============================================================================
// Formatting
// =============================================================================

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function getLineClass(entry: LogEntry): string {
  if (entry.level === 'stderr') return 'log-stderr'
  const msg = entry.message
  if (msg.includes('❌') || msg.includes('Error') || msg.includes('FAILED')) return 'log-error'
  if (msg.includes('⚠️') || msg.includes('WARN')) return 'log-warn'
  if (msg.includes('✅') || msg.includes('✔')) return 'log-success'
  if (msg.includes('🎯') || msg.includes('💰') || msg.includes('🎬') || msg.includes('🗣️')) return 'log-highlight'
  return ''
}

/** Coloriza tags [Stage] e emojis no texto */
function colorize(text: string): string {
  // Escape HTML primeiro
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    // Colorizar [Tags]
    .replace(/\[([^\]]+)\]/g, '<span class="log-tag">[$1]</span>')
    // Colorizar números com unidade (ex: 120s, 5.2s, 1024 KB)
    .replace(/(\d+\.?\d*)\s?(s|ms|KB|MB|tokens|words|cenas|scenes|items)/gi, '<span class="log-number">$1$2</span>')
}

// =============================================================================
// Lifecycle
// =============================================================================

onMounted(() => {
  connect()
})

onUnmounted(() => {
  disconnect()
  if (activityTimeout) clearTimeout(activityTimeout)
})
</script>

<style scoped>
/* ========================================================================= */
/* FAB (Floating Action Button)                                              */
/* ========================================================================= */

.ai-log-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9998;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(10,10,15,0.9);
  backdrop-filter: blur(20px);
  color: rgba(255,255,255,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
}

.ai-log-fab:hover {
  color: #FA5401;
  border-color: rgba(250, 84, 1, 0.3);
  transform: scale(1.05);
  box-shadow: 0 4px 30px rgba(250, 84, 1, 0.15);
}

.ai-log-fab.is-open {
  color: #FA5401;
  border-color: rgba(250, 84, 1, 0.4);
  background: rgba(250, 84, 1, 0.1);
}

.ai-log-fab.has-activity {
  animation: pulse-glow 1.5s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
  50% { box-shadow: 0 4px 30px rgba(250, 84, 1, 0.25), 0 0 20px rgba(250, 84, 1, 0.1); }
}

.unread-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: #FA5401;
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}

/* ========================================================================= */
/* OVERLAY                                                                   */
/* ========================================================================= */

.ai-log-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 24px;
}

/* ========================================================================= */
/* PANEL                                                                     */
/* ========================================================================= */

.ai-log-panel {
  width: 100%;
  max-width: 1100px;
  height: 70vh;
  max-height: 700px;
  background: #0C0C12;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow:
    0 32px 64px rgba(0,0,0,0.5),
    0 0 0 1px rgba(255,255,255,0.03) inset;
}

/* ========================================================================= */
/* HEADER                                                                    */
/* ========================================================================= */

.ai-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
  backdrop-filter: blur(10px);
  gap: 12px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.header-dot.red { background: #FF5F56; }
.header-dot.yellow { background: #FFBD2E; }
.header-dot.green { background: #27C93F; }

.header-title {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.6);
  letter-spacing: 0.05em;
  margin-left: 8px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.connection-status {
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.connection-status.online { color: #27C93F; }
.connection-status.offline { color: #FF5F56; }

.log-count {
  font-family: monospace;
  font-size: 10px;
  color: rgba(255,255,255,0.3);
}

.header-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.3);
  cursor: pointer;
  transition: all 0.2s;
}

.header-btn:hover {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
}

.close-btn:hover {
  background: rgba(255,95,86,0.15);
  color: #FF5F56;
}

/* ========================================================================= */
/* TERMINAL BODY                                                             */
/* ========================================================================= */

.ai-log-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 16px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace;
  font-size: 12px;
  line-height: 1.7;
  scroll-behavior: smooth;
}

/* Scrollbar premium */
.ai-log-body::-webkit-scrollbar {
  width: 6px;
}
.ai-log-body::-webkit-scrollbar-track {
  background: transparent;
}
.ai-log-body::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
}
.ai-log-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.15);
}

/* ========================================================================= */
/* LOG LINES                                                                 */
/* ========================================================================= */

.log-line {
  display: flex;
  gap: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background 0.15s;
  word-break: break-word;
}

.log-line:hover {
  background: rgba(255,255,255,0.02);
}

.log-time {
  color: rgba(255,255,255,0.15);
  flex-shrink: 0;
  font-size: 10px;
  padding-top: 2px;
  user-select: none;
}

.log-message {
  color: rgba(255,255,255,0.65);
  white-space: pre-wrap;
}

/* Log levels */
.log-stderr .log-message { color: #FF6B6B; }
.log-error .log-message { color: #FF5F56; font-weight: 600; }
.log-warn .log-message { color: #FFBD2E; }
.log-success .log-message { color: #27C93F; }
.log-highlight .log-message { color: #5BC0DE; }

/* Tags inline [Stage] */
:deep(.log-tag) {
  color: #FA5401;
  font-weight: 700;
}

:deep(.log-number) {
  color: #B8A3F3;
}

/* Empty state */
.log-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: rgba(255,255,255,0.2);
  font-size: 13px;
}

/* ========================================================================= */
/* SCROLL INDICATOR                                                          */
/* ========================================================================= */

.scroll-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px;
  background: rgba(250, 84, 1, 0.1);
  border-top: 1px solid rgba(250, 84, 1, 0.2);
  color: #FA5401;
  font-family: monospace;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.scroll-indicator:hover {
  background: rgba(250, 84, 1, 0.15);
}

/* ========================================================================= */
/* TRANSITIONS                                                               */
/* ========================================================================= */

.lightbox-enter-active {
  transition: opacity 0.25s ease;
}
.lightbox-enter-active .ai-log-panel {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}
.lightbox-leave-active {
  transition: opacity 0.2s ease;
}
.lightbox-leave-active .ai-log-panel {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.lightbox-enter-from {
  opacity: 0;
}
.lightbox-enter-from .ai-log-panel {
  transform: translateY(40px);
  opacity: 0;
}
.lightbox-leave-to {
  opacity: 0;
}
.lightbox-leave-to .ai-log-panel {
  transform: translateY(20px);
  opacity: 0;
}
</style>
