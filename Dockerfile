# Multi-stage Dockerfile para The Gap Files Hub
# Otimizado para Render.com com suporte a Whisper Local

# ============================================
# Stage 1: Base com Python + Node.js
# ============================================
FROM node:20-bullseye-slim AS base

# Instalar Python 3.11 e dependências do sistema
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    python3-dev \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Criar symlink para python
RUN ln -s /usr/bin/python3.11 /usr/bin/python

# Atualizar pip
RUN python -m pip install --upgrade pip

WORKDIR /app

# ============================================
# Stage 2: Dependências Python (Whisper)
# ============================================
FROM base AS python-deps

# Copiar requirements
COPY scripts/requirements.txt /app/scripts/requirements.txt

# Instalar dependências Python
RUN pip install --no-cache-dir -r /app/scripts/requirements.txt

# Pré-baixar modelo Whisper medium (evita download em runtime)
RUN python -c "import whisper; whisper.load_model('medium')"

# ============================================
# Stage 3: Dependências Node.js
# ============================================
FROM base AS node-deps

# Copiar package files
COPY package*.json ./

# Instalar dependências Node.js
RUN npm ci --only=production && \
    npm cache clean --force

# ============================================
# Stage 4: Build da aplicação
# ============================================
FROM base AS builder

# Copiar dependências Python
COPY --from=python-deps /root/.cache /root/.cache
COPY --from=python-deps /usr/local/lib/python3.11 /usr/local/lib/python3.11

# Copiar dependências Node.js
COPY --from=node-deps /app/node_modules ./node_modules

# Copiar código fonte
COPY . .

# Build Nuxt
RUN npm run build

# ============================================
# Stage 5: Produção (imagem final)
# ============================================
FROM node:20-bullseye-slim AS production

# Instalar apenas runtime necessário
RUN apt-get update && apt-get install -y \
    python3.11 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Criar symlink para python
RUN ln -s /usr/bin/python3.11 /usr/bin/python

WORKDIR /app

# Copiar dependências Python (incluindo modelo Whisper)
COPY --from=python-deps /root/.cache /root/.cache
COPY --from=python-deps /usr/local/lib/python3.11 /usr/local/lib/python3.11

# Copiar dependências Node.js
COPY --from=node-deps /app/node_modules ./node_modules

# Copiar build da aplicação
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma ./prisma

# Copiar package.json para scripts
COPY package*.json ./

# Variáveis de ambiente
ENV NODE_ENV=production
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando de inicialização
CMD ["node", ".output/server/index.mjs"]
