# 🚀 Deploy no Render.com - The Gap Files Hub

## 📋 Pré-requisitos

- ✅ Conta no [Render.com](https://render.com)
- ✅ Repositório Git (GitHub, GitLab ou Bitbucket)
- ✅ Código commitado e pushed

---

## 🎯 Opção 1: Deploy Automático (Blueprint)

### Passo 1: Conectar Repositório

1. Acesse [Render Dashboard](https://dashboard.render.com)
2. Clique em **"New +"** → **"Blueprint"**
3. Conecte seu repositório Git
4. Selecione o branch (ex: `main`)

### Passo 2: Configurar Blueprint

O arquivo `render.yaml` já está configurado! O Render vai:
- ✅ Criar Web Service (Hub)
- ✅ Criar PostgreSQL Database
- ✅ Configurar variáveis de ambiente
- ✅ Configurar health check
- ✅ Alocar disco para modelos Whisper (5GB)

### Passo 3: Configurar Variáveis de Ambiente

No dashboard do Render, configure:

```env
# API Keys (obrigatórias)
REPLICATE_API_TOKEN=r8_...
OPENAI_API_KEY=sk-...

# Database (auto-configurado pelo Blueprint)
DATABASE_URL=postgresql://... (já configurado)

# Public API (configurar após primeiro deploy)
NUXT_PUBLIC_API_BASE=https://thegapfiles-hub.onrender.com
```

### Passo 4: Deploy

1. Clique em **"Apply"**
2. Aguarde build (~10-15 minutos na primeira vez)
3. Acesse a URL gerada!

---

## 🎯 Opção 2: Deploy Manual

### Passo 1: Criar Database

1. **New +** → **PostgreSQL**
2. Nome: `thegapfiles-db`
3. Database: `thegapfiles`
4. Region: `Oregon` (ou mais próximo)
5. Plan: `Starter` ($7/mês)
6. Criar

### Passo 2: Criar Web Service

1. **New +** → **Web Service**
2. Conectar repositório
3. Configurações:
   - **Name:** `thegapfiles-hub`
   - **Region:** `Oregon`
   - **Branch:** `main`
   - **Root Directory:** `hub`
   - **Environment:** `Docker`
   - **Dockerfile Path:** `./Dockerfile`
   - **Docker Context:** `.`

### Passo 3: Configurar Recursos

**Instance Type:**
- Starter: $7/mês (512MB RAM, 0.5 CPU)
- Standard: $25/mês (2GB RAM, 1 CPU) ⭐ **Recomendado**
- Pro: $85/mês (4GB RAM, 2 CPU)

**Disk:**
- Nome: `whisper-models`
- Mount Path: `/root/.cache`
- Size: `5GB`

### Passo 4: Variáveis de Ambiente

```env
NODE_ENV=production
DATABASE_URL=<copiar do database criado>
REPLICATE_API_TOKEN=r8_...
OPENAI_API_KEY=sk-...
NUXT_PUBLIC_API_BASE=https://thegapfiles-hub.onrender.com
```

### Passo 5: Deploy

1. Clique em **"Create Web Service"**
2. Aguarde build
3. Acesse!

---

## 🔧 Configurações Importantes

### Health Check

- **Path:** `/api/health`
- **Interval:** 30s
- **Timeout:** 10s
- **Retries:** 3

### Auto-Deploy

- ✅ Habilitado por padrão
- Toda vez que fizer push no branch, redeploy automático

### Logs

Acesse logs em tempo real:
```bash
# Via dashboard
Render Dashboard → Service → Logs

# Via CLI (opcional)
render logs -f thegapfiles-hub
```

---

## 📊 Estimativa de Custos (Render.com)

| Recurso | Plan | Custo/mês |
|---------|------|-----------|
| **Web Service** | Starter | $7 |
| **Web Service** | Standard | $25 ⭐ |
| **PostgreSQL** | Starter | $7 |
| **PostgreSQL** | Standard | $20 |
| **Disk (5GB)** | - | $0.25/GB = $1.25 |

**Total Mínimo:** $15.25/mês  
**Total Recomendado:** $33.25/mês (Standard Web + Starter DB)

---

## ⚡ Performance no Render.com

### Whisper Local

**Starter Plan (0.5 CPU):**
- Vídeo 30s: ~8-12 min ⚠️ (muito lento)

**Standard Plan (1 CPU):**
- Vídeo 30s: ~4-6 min ⭐ (aceitável)

**Pro Plan (2 CPU):**
- Vídeo 30s: ~2-3 min ✅ (bom)

**Recomendação:** Plan **Standard** ou superior para legendas.

### Alternativa: Processar Legendas em Worker Separado

Para melhor performance, considere:
1. Hub (Starter): Interface + API
2. Worker (Standard/Pro): Apenas processamento de legendas

---

## 🐳 Build Local (Teste)

Antes de fazer deploy, teste localmente:

```bash
# Build da imagem
docker build -t thegapfiles-hub .

# Rodar localmente
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e REPLICATE_API_TOKEN="r8_..." \
  -e OPENAI_API_KEY="sk-..." \
  thegapfiles-hub

# Acessar
http://localhost:3000
```

---

## 🔍 Troubleshooting

### Build Falha

**Erro:** "Python not found"
- ✅ Já resolvido no Dockerfile (instala Python 3.11)

**Erro:** "Whisper model download timeout"
- ✅ Já resolvido: modelo é baixado durante build

**Erro:** "Out of memory"
- ⚠️ Upgrade para plan maior (Standard ou Pro)

### Runtime Lento

**Legendas demorando muito:**
- Upgrade para Standard/Pro
- Ou use modelo `small` ao invés de `medium`

**Database timeout:**
- Verificar DATABASE_URL
- Verificar se database está na mesma região

---

## 📝 Checklist de Deploy

- [ ] Código commitado e pushed
- [ ] `render.yaml` configurado
- [ ] Variáveis de ambiente prontas
- [ ] Database criado (ou será criado pelo Blueprint)
- [ ] Disk configurado (5GB para Whisper)
- [ ] Health check testado localmente
- [ ] Build Docker testado localmente
- [ ] Deploy iniciado
- [ ] Logs monitorados
- [ ] URL acessível
- [ ] Teste de criação de vídeo
- [ ] Teste de legendas

---

## 🎊 Pronto!

Após o deploy:
1. Acesse a URL do Render
2. Crie um dossier
3. Gere um vídeo
4. Adicione legendas
5. Compartilhe! 🚀

---

## 📚 Referências

- [Render.com Docs](https://render.com/docs)
- [Render Blueprint Spec](https://render.com/docs/blueprint-spec)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Nuxt Deployment](https://nuxt.com/docs/getting-started/deployment)
