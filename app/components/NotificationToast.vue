<script setup lang="ts">
import { useNotification } from '../utils/useNotification'

const { notifications, remove } = useNotification()
</script>

<template>
  <div class="notifications-container">
    <TransitionGroup name="notification">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="notification"
        :class="`notification-${notification.type}`"
        @click="remove(notification.id)"
      >
        <div class="notification-icon">
          <span v-if="notification.type === 'success'">✓</span>
          <span v-else-if="notification.type === 'error'">✕</span>
          <span v-else-if="notification.type === 'warning'">⚠</span>
          <span v-else>ℹ</span>
        </div>
        <div class="notification-message">{{ notification.message }}</div>
        <button class="notification-close" @click.stop="remove(notification.id)">✕</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.notifications-container {
  position: fixed;
  top: var(--space-lg);
  right: var(--space-lg);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  max-width: 400px;
}

.notification {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  cursor: pointer;
  transition: all var(--transition-base);
}

.notification:hover {
  transform: translateX(-4px);
  box-shadow: var(--shadow-xl);
}

.notification-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.9rem;
  font-weight: 700;
  flex-shrink: 0;
}

.notification-success {
  border-left: 4px solid var(--color-success);
}

.notification-success .notification-icon {
  background: var(--color-success);
  color: white;
}

.notification-error {
  border-left: 4px solid var(--color-error);
}

.notification-error .notification-icon {
  background: var(--color-error);
  color: white;
}

.notification-warning {
  border-left: 4px solid var(--color-warning);
}

.notification-warning .notification-icon {
  background: var(--color-warning);
  color: white;
}

.notification-info {
  border-left: 4px solid var(--color-primary);
}

.notification-info .notification-icon {
  background: var(--color-primary);
  color: white;
}

.notification-message {
  flex: 1;
  color: var(--color-text);
  font-size: 0.9rem;
  line-height: 1.4;
}

.notification-close {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
  flex-shrink: 0;
}

.notification-close:hover {
  background: var(--color-bg-card);
  color: var(--color-text);
}

/* Transitions */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.8);
}
</style>
