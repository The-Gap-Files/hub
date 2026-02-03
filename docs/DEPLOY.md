# 🚀 Guia de Deploy - The Gap Files Hub

## 📋 Pré-requisitos

- Node.js 18+ instalado
- PostgreSQL configurado
- Variáveis de ambiente configuradas

## 🔧 Setup Inicial

### 1. Clone e instale dependências

```bash
git clone <repo-url>
cd hub
npm install
```

### 2. Configure variáveis de ambiente

Crie um arquivo `.env`:

```env
DATABASE_URL="postgresql://user:password@host:5432/database"
OPENAI_API_KEY="sk-..."
REPLICATE_API_TOKEN="r8_..."
# ... outras variáveis
```

### 3. Execute migrations

```bash
npx prisma migrate deploy
```

### 4. **Inicialize dados essenciais**

**Opção A: Automático (ao iniciar o servidor)**
```bash
npm run dev
# ou em produção
npm run build
npm run preview
```

O plugin `server/plugins/db-init.ts` rodará automaticamente e criará:
- ✅ 5 Estilos Visuais padrão
- ✅ 4 Estilos de Roteiro padrão

**Opção B: Manual (útil para CI/CD)**
```bash
npm run db:init
```

## 🌍 Deploy em Produção

### Vercel / Netlify / Similar

1. Configure as variáveis de ambiente no painel
2. Configure o build command:
   ```bash
   npm run build
   ```
3. Configure o start command:
   ```bash
   node .output/server/index.mjs
   ```

**A inicialização do banco acontecerá automaticamente no primeiro start!** 🎉

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN npx prisma generate
RUN npm run build

# Migrations e inicialização
CMD npx prisma migrate deploy && node .output/server/index.mjs
```

### VPS / Servidor Dedicado

```bash
# 1. Clone e instale
git clone <repo-url>
cd hub
npm ci --production

# 2. Build
npm run build

# 3. Migrations
npx prisma migrate deploy

# 4. Inicializar dados (opcional, pois o plugin fará isso)
npm run db:init

# 5. Start com PM2
pm2 start npm --name "thegapfiles-hub" -- run preview
pm2 save
pm2 startup
```

## 🔄 Atualizações

Ao fazer deploy de uma nova versão:

```bash
git pull
npm install
npx prisma migrate deploy
npm run build
pm2 restart thegapfiles-hub
```

**Nota:** O plugin de inicialização verifica se os dados já existem, então é **seguro** rodar múltiplas vezes!

## ✅ Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados PostgreSQL acessível
- [ ] Migrations executadas (`npx prisma migrate deploy`)
- [ ] Build gerado (`npm run build`)
- [ ] Dados inicializados (automático ou `npm run db:init`)
- [ ] Servidor iniciado e rodando
- [ ] Verificar logs: estilos visuais e de roteiro criados

## 📊 Verificação Pós-Deploy

Acesse o painel e verifique:

1. **Configurações → Estilos Visuais**
   - Deve mostrar 5 estilos padrão

2. **Configurações → Estilos de Roteiro**
   - Deve mostrar 4 estilos padrão

3. **Criar Novo Vídeo**
   - Selects devem estar populados com os estilos

## 🐛 Troubleshooting

### "Nenhum estilo disponível"

Execute manualmente:
```bash
npm run db:init
```

### "Erro ao conectar no banco"

Verifique:
- `DATABASE_URL` está correta
- PostgreSQL está rodando
- Firewall permite conexão

### "Migrations pendentes"

Execute:
```bash
npx prisma migrate deploy
```

## 📝 Logs Esperados

Ao iniciar o servidor, você deve ver:

```
🚀 Inicializando banco de dados...
🎨 Inicializando estilos visuais...
✅ 5 estilos visuais criados
📝 Inicializando estilos de roteiro...
✅ 4 estilos de roteiro criados
✨ Inicialização concluída!
```

Ou, se já existirem:

```
🚀 Inicializando banco de dados...
✓ 5 estilos visuais já existem
✓ 4 estilos de roteiro já existem
✨ Inicialização concluída!
```

## 🎯 Próximos Passos

Após o deploy bem-sucedido:

1. Acesse o painel administrativo
2. Configure os provedores de IA
3. Personalize os estilos visuais e de roteiro
4. Crie seu primeiro vídeo! 🎬
