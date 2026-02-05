<script setup lang="ts">
// Redirecionar para /dossiers (novo sistema Document-First)
await navigateTo('/dossiers', { replace: true })
</script>

<template>
  <div class="loading-state">
    <div class="spinner"></div>
    <p>Redirecionando...</p>
  </div>
</template>

<style scoped>
/* Dashboard Layout */
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-xl);
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2xl);
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.logo-icon {
  font-size: 2rem;
  color: var(--color-primary);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.logo h1 {
  font-size: 1.75rem;
  font-weight: 700;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tagline {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-lg);
  margin-bottom: var(--space-2xl);
}

.stat-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  transition: all var(--transition-base);
}

.stat-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-glow);
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.stat-processing .stat-value { color: var(--color-info); }
.stat-completed .stat-value { color: var(--color-success); }
.stat-failed .stat-value { color: var(--color-error); }

/* Filters */
.filters {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.filter-select,
.filter-search {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.filter-select:focus,
.filter-search:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.filter-search {
  flex: 1;
  max-width: 300px;
}

/* Video List */
.video-list {
  margin-bottom: var(--space-xl);
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-lg);
}

.video-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--transition-base);
}

.video-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-lg);
}

.video-thumbnail {
  aspect-ratio: 16/9;
  background: var(--color-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  font-size: 3rem;
  opacity: 0.3;
}

.video-info {
  padding: var(--space-md);
}

.video-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: var(--space-xs);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.video-theme {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: var(--space-sm);
}

.video-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.date {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.video-actions {
  padding: 0 var(--space-md) var(--space-md);
  display: flex;
  justify-content: flex-end;
}

/* Badges */
.badge {
  display: inline-flex;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-pending {
  background: rgba(113, 113, 122, 0.2);
  color: var(--color-text-muted);
}

.badge-processing {
  background: rgba(59, 130, 246, 0.2);
  color: var(--color-info);
}

.badge-success {
  background: rgba(16, 185, 129, 0.2);
  color: var(--color-success);
}

.badge-error {
  background: rgba(239, 68, 68, 0.2);
  color: var(--color-error);
}

.badge-muted {
  background: rgba(113, 113, 122, 0.1);
  color: var(--color-text-muted);
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2xl);
  gap: var(--space-md);
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 4rem;
  opacity: 0.3;
}

.empty-state h3 {
  font-size: 1.25rem;
  color: var(--color-text);
}

.empty-state p {
  color: var(--color-text-muted);
  max-width: 400px;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-lg);
}

.btn-page {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-page:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.btn-page:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  padding: var(--space-lg);
  overflow-y: auto;
}

.modal {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  animation: modalIn 200ms ease;
  margin: auto;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
}

.btn-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.5rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.btn-close:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text);
}

.modal-body {
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.form-group textarea,
.form-group select {
  padding: var(--space-md);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.875rem;
  resize: vertical;
  transition: all var(--transition-fast);
}

.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.form-group-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) 0;
}

.checkbox-label {
  display: flex;
  flex-direction: column;
}

.label-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.label-desc {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-border);
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--color-primary);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--color-primary);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.modal-footer {
  padding: var(--space-lg);
  background: var(--color-bg-elevated);
  border-top: 1px solid var(--color-border);
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  flex-shrink: 0;
}
</style>

