<script setup lang="ts">
import { 
  Zap, Cpu, Settings, ShieldCheck, Activity,
  Lock, Globe, Database, Server, ChevronRight,
  AlertTriangle
} from 'lucide-vue-next'
</script>

<template>
  <div class="min-h-screen bg-oled-black pb-20 selection:bg-amber-500/30">
    <div class="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in duration-1000">
      <header class="flex flex-col md:flex-row justify-between items-end gap-6 mb-16 relative group">
        <div class="absolute -inset-x-8 -top-8 h-40 bg-gradient-to-b from-amber-500/5 to-transparent blur-3xl opacity-50"></div>
        
        <div class="relative space-y-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Zap :size="24" />
            </div>
            <span class="mono-label tracking-[0.4em] text-amber-500/60 font-black">AI Core Matrix</span>
          </div>
          <h1 class="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
            Núcleos de <span class="text-amber-500">IA</span>
          </h1>
          <p class="text-zinc-500 font-medium max-w-md">Configure os terminais de inferência e tokens de processamento neural.</p>
        </div>

        <div class="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
           <div class="flex flex-col text-right">
              <span class="mono-label !text-[8px] text-zinc-500 uppercase">System Integrity</span>
              <span class="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Stable Connection</span>
           </div>
           <div class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse"></div>
        </div>
      </header>

      <!-- Placeholder Professional -->
      <div class="py-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.01] relative overflow-hidden group">
        <!-- background icon -->
        <Cpu :size="300" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/[0.02] -rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
        
        <div class="relative mb-12">
          <div class="w-24 h-24 bg-amber-500/5 rounded-3xl flex items-center justify-center border border-amber-500/20 shadow-glow relative z-10">
             <Settings :size="48" class="text-amber-500 animate-spin-slow" />
          </div>
          <div class="absolute -top-4 -right-4 w-10 h-10 bg-black border border-white/10 rounded-xl flex items-center justify-center text-amber-500/50">
             <Lock :size="20" />
          </div>
        </div>

        <h3 class="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">Interface de Encriptação</h3>
        <p class="mono-label !text-xs text-zinc-500 max-w-sm text-center leading-relaxed">
          Os núcleos de conexão com OpenAI, Replicate e ElevenLabs estão sendo migrados para o protocolo Antigravity v4.0.
        </p>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 w-full max-w-4xl px-8">
           <div v-for="i in 4" :key="i" class="glass-card p-6 border-white/5 flex flex-col items-center gap-3 opacity-40">
              <Server :size="24" class="text-zinc-700" />
              <div class="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                 <div class="h-full bg-amber-500/20 w-1/2"></div>
              </div>
              <span class="mono-label !text-[8px] text-zinc-600">Encrypted_Node_{{i}}</span>
           </div>
        </div>

        <button class="mt-16 px-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] hover:text-white hover:border-amber-500/50 transition-all cursor-not-allowed">
           Awaiting authorization...
        </button>
      </div>

      <!-- Quick Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
         <div class="glass-card p-8 border-white/5 flex items-center gap-6">
            <div class="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
               <Globe :size="24" />
            </div>
            <div>
               <p class="mono-label !text-[8px] text-zinc-500 px-0">API Gateway</p>
               <h4 class="text-lg font-black text-white uppercase italic">Multi-Region</h4>
            </div>
         </div>
         <div class="glass-card p-8 border-white/5 flex items-center gap-6">
            <div class="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20">
               <ShieldCheck :size="24" />
            </div>
            <div>
               <p class="mono-label !text-[8px] text-zinc-500">Security layer</p>
               <h4 class="text-lg font-black text-white uppercase italic">AES-256-GCM</h4>
            </div>
         </div>
         <div class="glass-card p-8 border-white/5 flex items-center gap-6">
            <div class="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
               <Activity :size="24" />
            </div>
            <div>
               <p class="mono-label !text-[8px] text-zinc-500">Global traffic</p>
               <h4 class="text-lg font-black text-white uppercase italic">0.0ms Latency</h4>
            </div>
         </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-spin-slow {
  animation: spin 10s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
