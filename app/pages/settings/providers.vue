<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1 class="page-title">Provedores de IA</h1>
        <p class="page-description">
          Configure as APIs e provedores de inteligência artificial
        </p>
      </div>
    </header>

    <div class="content-placeholder">
      <div class="placeholder-icon">⚙️</div>
      <h2>Configuração de Provedores</h2>
      <p>Interface em desenvolvimento...</p>
      <p class="placeholder-info">
        Aqui você poderá configurar as chaves de API e preferências<br>
        para OpenAI, Replicate, ElevenLabs, RunPod e outros provedores.
      </p>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-2xl);
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: var(--space-xs);
}

.page-description {
  color: var(--color-text-muted);
  font-size: 1rem;
}

.content-placeholder {
  background: var(--color-bg-card);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-2xl);
  text-align: center;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 4rem;
  margin-bottom: var(--space-lg);
  opacity: 0.5;
}

.content-placeholder h2 {
  font-size: 1.5rem;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}

.content-placeholder p {
  color: var(--color-text-muted);
  margin-bottom: var(--space-md);
}

.placeholder-info {
  font-size: 0.9rem;
  line-height: 1.8;
}
</style>
