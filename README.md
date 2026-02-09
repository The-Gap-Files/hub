# The Gap Files — Hub

> *"O que aconteceu nos intervalos que ninguém viu?"*

Hub de produção automatizada de vídeos para o canal **The Gap Files**. Mistérios, conspirações e eventos inexplicáveis da história.

## 🎬 Visão Geral

O Hub orquestra todo o pipeline de produção de vídeos — da pesquisa ao vídeo final — usando uma **arquitetura Dossier-First**:

```
Dossier → Script → Audio → Imagens → Motion → Renderização → Legendas → Aprovação
```

1. **Dossier** — Dossiê com fontes (documentos, artigos, PDFs), imagens e notas
2. **Script** — Roteiro segmentado em cenas (narração + descrição visual)
3. **Audio** — Narração com vozes de alta qualidade (ElevenLabs)
4. **Imagens** — Geração cinematográfica com estilos visuais e seeds
5. **Motion** — Animação de cenas via modelos de vídeo IA
6. **Renderização** — Montagem final com FFmpeg
7. **Legendas** — Auto-captioning via ElevenLabs Scribe
8. **Aprovação** — Revisão e aprovação do vídeo final

## 🛠️ Stack Tecnológica

| Componente | Tecnologia |
|------------|------------|
| Frontend | Nuxt 4 (Vue 3) + TailwindCSS |
| Backend/API | Nitro (Server Engine) |
| Banco de Dados | PostgreSQL + Prisma 7 |
| State Management | Pinia |
| Scripts LLM | Anthropic Claude |
| Text-to-Speech | ElevenLabs (Multilingual v2) |
| Image Generation | Replicate (Luma Photon Flash) |
| Motion Generation | Replicate / RunPod |
| Video Editing | FFmpeg |
| Auto-Captioning | ElevenLabs Dubbing API (Scribe v2) |

## 📁 Estrutura do Projeto

```
hub/
├── app/                              # Frontend Nuxt
│   ├── layouts/default.vue           # Sidebar + navigation
│   ├── pages/
│   │   ├── index.vue                 # Terminal Central (dashboard)
│   │   ├── channels/index.vue        # Gestão de canais (CRUD)
│   │   ├── dossiers/
│   │   │   ├── index.vue             # Lista de dossiers
│   │   │   ├── new.vue               # Criar novo dossier
│   │   │   └── [id]/
│   │   │       ├── index.vue         # Detalhe do dossier
│   │   │       └── produce.vue       # Modal de produção (5 steps)
│   │   ├── outputs/[id].vue          # Detalhe do output (pipeline)
│   │   └── settings/seeds.vue        # Banco genético (seeds)
│   └── components/                   # Componentes reutilizáveis
│
├── server/                           # Backend Nitro
│   ├── api/                          # Endpoints REST
│   │   ├── channels/                 # CRUD de canais
│   │   ├── dossiers/                 # CRUD de dossiers + outputs
│   │   ├── styles/                   # Visual + Script styles
│   │   └── tools/                    # Ferramentas (extração, resumo)
│   ├── services/                     # Lógica de negócio
│   │   ├── providers/                # Provedores de IA (modular)
│   │   │   ├── script/               # Anthropic, OpenAI
│   │   │   ├── tts/                  # ElevenLabs, Replicate
│   │   │   ├── image/                # Replicate
│   │   │   └── motion/               # Replicate, RunPod
│   │   └── pipeline/                 # Orquestração do pipeline
│   ├── constants/                    # Estilos, formatos, classificações
│   ├── types/                        # TypeScript interfaces
│   └── __tests__/                    # Testes de integração
│
├── prisma/
│   ├── schema.prisma                 # Modelos (Dossier, Output, Channel, etc.)
│   └── seed-thegapfiles-channel.ts   # Seed do canal principal
│
└── scripts/                          # Utilitários
```

## 🚀 Começando

### Pré-requisitos

- Node.js 22+
- PostgreSQL 17+
- Contas nas APIs: Anthropic, ElevenLabs, Replicate

### Instalação

```bash
cd hub
npm install

# Configurar ambiente
cp .env.example .env
# Editar .env com suas credenciais
```

### Banco de Dados

```bash
# Sincronizar schema com o banco
npx prisma db push

# Criar canal inicial
npx tsx prisma/seed-thegapfiles-channel.ts

# (Opcional) Criar banco de teste
node scripts/create-test-db.cjs
npx prisma db push --url "postgresql://...thegapfile_db_test?schema=public"
```

### Executar

```bash
# Desenvolvimento
npm run dev

# Testes (usa banco separado _test)
npm test

# Docker
npm run docker:build
npm run docker:run
```

## 🔌 Provedores de IA (Modular)

O sistema suporta troca de provedores via `.env`:

```env
SCRIPT_PROVIDER="anthropic"    # ou "openai"
TTS_PROVIDER="elevenlabs"      # narração
IMAGE_PROVIDER="replicate"     # imagens
MOTION_PROVIDER="replicate"    # motion/vídeo
```

Cada provedor implementa uma interface (`IScriptGenerator`, `ITTSProvider`, etc.) — basta trocar no `.env`.

## 📊 Modelo de Dados

### Entidades principais

- **Channel** — Canal de distribuição (YouTube, TikTok, etc.)
- **Dossier** — Dossiê com pesquisa e fontes
- **Output** — Vídeo produzido (com script, scenes, audio, images)
- **Seed** — Código genético visual (determina estilo das imagens)

### Pipeline do Output

```
PENDING → SCRIPT → AUDIO → IMAGES → MOTION → RENDERED → COMPLETED
                                                  ↓
                                               FAILED
```

## 🧪 Testes

Os testes usam um banco PostgreSQL separado (`thegapfile_db_test`) com:
- **Auto-sync** do schema via `prisma db push` no `beforeAll`
- **Isolamento** via `TRUNCATE` no `beforeEach`
- **Guard de segurança** que impede rodar contra o banco de produção

```bash
npm test
```

## 📄 Licença

Projeto privado — The Gap Files © 2026
