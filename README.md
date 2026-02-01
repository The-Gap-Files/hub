# The Gap Files - Video Automation Engine

Sistema de automação para criação de vídeos de YouTube focado em **História do Mundo** e **Teorias da Conspiração**.

## 🎬 Visão Geral

Este projeto automatiza todo o pipeline de produção de vídeos:

1. **Roteirização** - Geração de scripts segmentados em cenas (narração + descrição visual)
2. **Áudio** - Conversão do roteiro em narração com vozes de alta qualidade
3. **Imagens** - Geração de imagens cinematográficas para cada cena
4. **Edição** - Montagem do vídeo final com áudio, imagens e legendas

## 🛠️ Stack Tecnológica

| Componente | Tecnologia |
|------------|------------|
| Frontend/Orquestrador | Nuxt 4 (Vue 3) |
| Backend/API | Nitro (Server Engine do Nuxt) |
| Banco de Dados | PostgreSQL + Prisma ORM |
| Scripts LLM | OpenAI GPT-4 / Anthropic / Gemini |
| Text-to-Speech | ElevenLabs (Multilingual v2) |
| Image Generation | Replicate (FLUX) / Stable Diffusion |
| Video Editing | FFmpeg (em desenvolvimento) |

## 📁 Estrutura do Projeto

```
hub/
├── app/                          # Frontend Nuxt
│   ├── app.vue                   # Dashboard principal
│   └── stores/                   # Pinia stores
│       └── video.store.ts        # Estado dos vídeos
│
├── server/                       # Backend Nitro
│   ├── api/                      # Endpoints REST
│   │   └── videos/
│   │       ├── index.get.ts      # GET /api/videos
│   │       ├── index.post.ts     # POST /api/videos
│   │       └── [id].get.ts       # GET /api/videos/:id
│   │
│   ├── services/                 # Lógica de negócio
│   │   ├── providers/            # Provedores de IA (modular)
│   │   │   ├── script/           # Geradores de roteiro
│   │   │   ├── tts/              # Text-to-Speech
│   │   │   ├── image/            # Geradores de imagem
│   │   │   └── index.ts          # Factory & Manager
│   │   │
│   │   └── pipeline/             # Orquestração do pipeline
│   │       └── video-pipeline.service.ts
│   │
│   ├── plugins/                  # Plugins Nitro
│   │   └── providers.ts          # Inicialização dos providers
│   │
│   ├── types/                    # TypeScript interfaces
│   │   └── ai-providers.ts       # Contratos dos provedores
│   │
│   └── utils/                    # Utilitários
│       └── prisma.ts             # Singleton do Prisma
│
├── prisma/                       # Banco de dados
│   └── schema.prisma             # Definição dos modelos
│
└── .env.example                  # Variáveis de ambiente
```

## 🚀 Começando

### 1. Pré-requisitos

- Node.js 20+
- PostgreSQL 15+
- Contas nas APIs de IA (OpenAI, ElevenLabs, Replicate)

### 2. Instalação

```bash
# Clonar e instalar
cd hub
npm install

# Configurar ambiente
cp .env.example .env
# Editar .env com suas credenciais
```

### 3. Configurar Banco de Dados

```bash
# Gerar cliente Prisma
npx prisma generate

# Aplicar migrations
npx prisma migrate dev --name init
```

### 4. Executar

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm run preview
```

## 🔌 Modularidade dos Provedores

O sistema foi projetado para **trocar APIs de IA facilmente**. Cada tipo de provedor implementa uma interface:

```typescript
// Para trocar o gerador de scripts:
// 1. Implemente IScriptGenerator
// 2. Registre no factory (server/services/providers/index.ts)
// 3. Altere SCRIPT_PROVIDER no .env

interface IScriptGenerator {
  generate(request: ScriptGenerationRequest): Promise<ScriptGenerationResponse>
  getName(): string
}
```

### Provedores Suportados

| Tipo | Provedores Disponíveis |
|------|------------------------|
| Script | OpenAI ✅, Anthropic 🔜, Gemini 🔜 |
| TTS | ElevenLabs ✅, OpenAI TTS 🔜 |
| Image | Replicate ✅, DALL-E 🔜, Midjourney 🔜 |

## 📊 Modelo de Dados

O schema do banco suporta todo o ciclo de vida do vídeo:

- **Video** - Entidade principal com status do pipeline
- **Script** - Roteiro completo gerado
- **Scene** - Segmentos com narração + descrição visual
- **SceneImage** - Imagens geradas para cada cena
- **AudioTrack** - Trilhas de áudio (narração, música)
- **PipelineExecution** - Logs de execução

### Status do Vídeo

```
PENDING → SCRIPT_GENERATING → SCRIPT_READY 
        → AUDIO_GENERATING → AUDIO_READY 
        → IMAGES_GENERATING → IMAGES_READY 
        → RENDERING → COMPLETED
                   ↓
                FAILED
```

## 📝 Roadmap

- [ ] Integração FFmpeg para renderização
- [ ] Suporte a Anthropic Claude
- [ ] Geração de thumbnails automática
- [ ] Legendas dinâmicas (captions)
- [ ] Fila de jobs (BullMQ)
- [ ] Upload automático para YouTube

## 📄 Licença

Projeto privado - The Gap Files © 2026
