<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
/* =============================================================================
   CSS VARIABLES - Design System
   ============================================================================= */
:root {
  /* Colors */
  --color-bg: #0a0a0f;
  --color-bg-elevated: #12121a;
  --color-bg-card: #1a1a24;
  --color-border: #2a2a3a;
  
  --color-text: #e4e4e7;
  --color-text-muted: #71717a;
  --color-text-accent: #a78bfa;
  
  --color-primary: #8b5cf6;
  --color-primary-hover: #7c3aed;
  
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
  
  /* Gradients */
  --gradient-primary: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  --gradient-dark: linear-gradient(180deg, #0a0a0f 0%, #1a1a24 100%);
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px rgba(139, 92, 246, 0.3);
  
  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  
  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  
  /* Border Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
}

/* =============================================================================
   GLOBAL STYLES
   ============================================================================= */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-sans);
  background: var(--gradient-dark);
  color: var(--color-text);
  min-height: 100vh;
  line-height: 1.6;
}
</style>
