<template>
  <div class="flex min-h-screen bg-[#050508] font-sans selection:bg-primary/30">
    <!-- Cyber Sidebar -->
    <aside class="fixed inset-y-0 left-0 w-72 bg-[#0A0A0F]/90 backdrop-blur-2xl border-r border-white/5 z-50 flex flex-col pt-10 shadow-[20px_0_50px_rgba(0,0,0,0.5)]">
      <!-- Logo Section - The Gap Files brand (ui-ux-pro-max: correct brand logos) -->
      <div class="px-6 mb-16 group cursor-pointer" @click="goHome">
        <div class="flex flex-col gap-2">
          <img
            src="/logo.svg"
            alt="The Gap Files"
            class="h-[120px] w-auto object-contain transition-opacity duration-300 group-hover:opacity-90"
            width="120"
            height="120"
          />
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-4 space-y-1">
        <div class="mono-label !text-[9px] px-4 mb-4 text-zinc-600 flex items-center justify-between">
          <span>Protocolos Centrais</span>
          <ChevronRight :size="10" class="opacity-20" />
        </div>
        
        <NuxtLink to="/" class="nav-item group" active-class="active">
          <LayoutDashboard :size="18" class="nav-icon" />
          <span class="nav-text">Terminal Central</span>
          <div class="active-indicator"></div>
          <div class="hover-glow"></div>
        </NuxtLink>

        <NuxtLink to="/dossiers" class="nav-item group" active-class="active">
          <Library :size="18" class="nav-icon" />
          <span class="nav-text">Cofre de Inteligência</span>
          <div class="active-indicator"></div>
          <div class="hover-glow"></div>
        </NuxtLink>

        <NuxtLink to="/channels" class="nav-item group" active-class="active">
          <Tv :size="18" class="nav-icon" />
          <span class="nav-text">Rede de Canais</span>
          <div class="active-indicator"></div>
          <div class="hover-glow"></div>
        </NuxtLink>

        <div class="pt-10 mb-4 px-4">
          <div class="mono-label !text-[9px] text-zinc-600 flex items-center justify-between">
            <span>Vetores de Engrenagem</span>
            <ChevronRight :size="10" class="opacity-20" />
          </div>
        </div>


        <NuxtLink to="/settings/seeds" class="nav-item group" active-class="active">
          <Database :size="18" class="nav-icon" />
          <span class="nav-text">Banco de Seeds</span>
        </NuxtLink>

        <NuxtLink to="/settings/providers" class="nav-item group" active-class="active">
          <Zap :size="18" class="nav-icon" />
          <span class="nav-text">Núcleos de IA</span>
        </NuxtLink>
      </nav>

      <!-- System Metadata -->
      <div class="px-8 mb-6">
        <div class="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5 font-mono text-[7px] text-zinc-600">
           <div class="flex justify-between uppercase">
             <span>Build Hash</span>
             <span class="text-zinc-400">#AG-40X-2026</span>
           </div>
           <div class="flex justify-between uppercase">
             <span>Local Node Scan</span>
             <span class="text-emerald-500/50">Verified</span>
           </div>
        </div>
      </div>

      <!-- User Panel -->
      <div class="p-4 border-t border-white/5 bg-[#08080C]">
        <div class="glass-card p-4 flex items-center gap-3 border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-500 cursor-pointer group rounded-2xl overflow-hidden relative">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white/50 border border-white/10 group-hover:border-primary/50 transition-colors z-10">
            <User :size="20" />
          </div>
          <div class="flex-1 min-w-0 z-10">
            <p class="text-xs font-black text-white uppercase tracking-wider truncate">Administrator</p>
            <p class="mono-label !text-[8px] text-primary">Nível de Acesso: S</p>
          </div>
          <Settings :size="14" class="text-zinc-600 group-hover:text-primary transition-colors z-10" />
          
          <!-- Liquid Glow Background -->
          <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 ml-72">
      <div class="relative min-h-screen">
        <!-- Floating Scanline Effect -->
        <div class="fixed inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-[60]"></div>
        
        <div class="relative z-10 p-0">
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { 
  LayoutDashboard, Library, Tv,
  Database, Zap, User, Settings,
  ChevronRight
} from 'lucide-vue-next'

const router = useRouter()
const goHome = () => router.push('/')
</script>

<style scoped>
.nav-item {
  @apply relative flex items-center gap-4 px-6 py-4 rounded-2xl text-zinc-500 transition-all duration-500 hover:text-white overflow-hidden;
}

.nav-icon {
  @apply transition-all duration-500 group-hover:scale-110 group-hover:text-primary group-hover:drop-shadow-[0_0_8px_rgba(250,84,1,0.3)];
}

.nav-text {
  @apply text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500;
}

.nav-item.active {
  @apply bg-white/5 text-primary shadow-[inset_0_0_20px_rgba(250,84,1,0.03)];
}

.nav-item.active .nav-icon {
  @apply text-primary scale-110 drop-shadow-[0_0_8px_rgba(250,84,1,0.5)];
}

.nav-item.active .nav-text {
  @apply translate-x-1 font-black;
}

.active-indicator {
  @apply absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-0 bg-primary rounded-r-full transition-all duration-700 opacity-0 shadow-[0_0_15px_#FA5401];
}

.nav-item.active .active-indicator {
  @apply h-8 opacity-100;
}

.hover-glow {
  @apply absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500;
}

.nav-item:hover .hover-glow {
  @apply opacity-100;
}

.nav-item.active .hover-glow {
  @apply opacity-100;
}
</style>

