<template>
  <div class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1 class="logo">
          <span class="logo-icon">🎬</span>
          The Gap Files
        </h1>
      </div>

      <nav class="sidebar-nav">
        <NuxtLink to="/" class="nav-item" active-class="active">
          <span class="nav-icon">🏠</span>
          <span class="nav-label">Dashboard</span>
        </NuxtLink>

        <NuxtLink to="/videos" class="nav-item" active-class="active">
          <span class="nav-icon">🎥</span>
          <span class="nav-label">Vídeos</span>
        </NuxtLink>

        <div class="nav-divider"></div>

        <div class="nav-section">
          <span class="nav-section-title">Configurações</span>
          
          <NuxtLink to="/settings/visual-styles" class="nav-item" active-class="active">
            <span class="nav-icon">🎨</span>
            <span class="nav-label">Estilos Visuais</span>
          </NuxtLink>

          <NuxtLink to="/settings/script-styles" class="nav-item" active-class="active">
            <span class="nav-icon">📝</span>
            <span class="nav-label">Estilos de Roteiro</span>
          </NuxtLink>

          <NuxtLink to="/settings/providers" class="nav-item" active-class="active">
            <span class="nav-icon">⚙️</span>
            <span class="nav-label">Provedores IA</span>
          </NuxtLink>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">👤</div>
          <div class="user-details">
            <div class="user-name">Admin</div>
            <div class="user-role">Produtor</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

/* =============================================================================
   SIDEBAR
   ============================================================================= */
.sidebar {
  width: 260px;
  background: var(--color-bg-elevated);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100vh;
  left: 0;
  top: 0;
  z-index: 100;
}

.sidebar-header {
  padding: var(--space-xl) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.logo-icon {
  font-size: 1.5rem;
}

/* Navigation */
.sidebar-nav {
  flex: 1;
  padding: var(--space-lg);
  overflow-y: auto;
}

.nav-section {
  margin-top: var(--space-lg);
}

.nav-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  padding: 0 var(--space-md);
  margin-bottom: var(--space-sm);
  display: block;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  text-decoration: none;
  transition: all var(--transition-base);
  margin-bottom: var(--space-xs);
}

.nav-item:hover {
  background: var(--color-bg-card);
  color: var(--color-text);
}

.nav-item.active {
  background: var(--color-primary);
  color: white;
}

.nav-icon {
  font-size: 1.25rem;
  width: 24px;
  text-align: center;
}

.nav-label {
  font-weight: 500;
  font-size: 0.9rem;
}

.nav-divider {
  height: 1px;
  background: var(--color-border);
  margin: var(--space-lg) 0;
}

/* Sidebar Footer */
.sidebar-footer {
  padding: var(--space-lg);
  border-top: 1px solid var(--color-border);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.user-details {
  flex: 1;
}

.user-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text);
}

.user-role {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* =============================================================================
   MAIN CONTENT
   ============================================================================= */
.main-content {
  flex: 1;
  margin-left: 260px;
  padding: var(--space-2xl);
  min-height: 100vh;
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform var(--transition-base);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .main-content {
    margin-left: 0;
  }
}
</style>
