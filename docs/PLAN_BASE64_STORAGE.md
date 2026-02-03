# Plano: Migração de Armazenamento de Arquivos para Base64 no Banco de Dados

## 📋 Contexto

**Solicitação do Usuário:**
"Hoje as imagens, áudios e vídeos são salvos em pastas. Não quero mais. Quero que sejam salvos no banco de dados em base64."

**Objetivo:**
Migrar o armazenamento de arquivos binários (imagens, áudios, vídeos) do sistema de arquivos para o banco de dados PostgreSQL usando codificação base64.

**Skills Aplicadas:**
- `database-design` - Schema design, optimization
- `prisma-expert` - Prisma ORM, migrations
- `nodejs-backend-patterns` - Production-ready Node.js patterns
- `architecture` - Architectural decision-making
- `plan-writing` - Structured task planning

**Impacto:**
- ✅ Simplifica backup (tudo no banco)
- ✅ Facilita deploy (sem gerenciar storage separado)
- ⚠️ Aumenta tamanho do banco (~33% overhead do base64)
- ⚠️ Pode impactar performance em queries grandes

---

## 🎯 Escopo

### Modelos Afetados:
1. **SceneImage** - Imagens geradas para cada cena
2. **AudioTrack** - Áudio narrado (TTS)
3. **SceneVideo** - Vídeos com motion (animação)
4. **Video** - Vídeo final renderizado

### Fora do Escopo (nesta fase):
- Thumbnails (podem continuar em arquivo por serem pequenos)
- Logs e metadados

---

## 📊 Análise de Impacto

### Database Schema Changes

**SceneImage:**
```prisma
model SceneImage {
  // REMOVER:
  - filePath: String
  - fileSize: Int
  
  // ADICIONAR:
  + fileData: String @db.Text  // Base64
  + mimeType: String           // image/png, image/jpeg
}
```

**AudioTrack:**
```prisma
model AudioTrack {
  // REMOVER:
  - filePath: String
  - fileSize: Int
  
  // ADICIONAR:
  + fileData: String @db.Text  // Base64
  + mimeType: String           // audio/mpeg, audio/wav
}
```

**SceneVideo:**
```prisma
model SceneVideo {
  // REMOVER:
  - filePath: String
  - fileSize: Int
  
  // ADICIONAR:
  + fileData: String @db.Text  // Base64
  + mimeType: String           // video/mp4
}
```

**Video:**
```prisma
model Video {
  // REMOVER:
  - outputPath: String?
  
  // ADICIONAR:
  + outputData: String? @db.Text  // Base64
  + outputMimeType: String?       // video/mp4
}
```

### Backend Changes

**Arquivos a Modificar:**

1. **Pipeline Service** (`server/services/pipeline/video-pipeline.service.ts`)
   - `generateImages()` - Salvar base64 em vez de arquivo
   - `generateAudio()` - Salvar base64 em vez de arquivo
   - `generateMotion()` - Salvar base64 em vez de arquivo
   - `renderVideo()` - Salvar base64 em vez de arquivo

2. **API Endpoints** (novos ou modificados)
   - `GET /api/videos/[id]/download` - Retorna vídeo decodificado
   - `GET /api/scenes/[id]/image` - Retorna imagem decodificada
   - `GET /api/scenes/[id]/audio` - Retorna áudio decodificado
   - `GET /api/scenes/[id]/video` - Retorna vídeo de cena decodificado

3. **Helpers/Utils** (criar)
   - `server/utils/base64.ts` - Encode/decode helpers
   - `server/utils/mime-types.ts` - Detecção de MIME type

### Frontend Changes

**Componentes a Modificar:**

1. **Video Player** (`app/components/VideoPlayer.vue`)
   - Aceitar base64 data URL em vez de file path
   - `<video :src="data:video/mp4;base64,...">`

2. **Image Display** (vários componentes)
   - Aceitar base64 data URL
   - `<img :src="data:image/png;base64,...">`

3. **Audio Player** (se existir)
   - Aceitar base64 data URL

---

## 🏗️ Plano de Implementação

### FASE 1: Database Schema ✅ (PRIORITÁRIO)

**Responsável:** `database-architect`
**Skills:** `database-design`, `prisma-expert`, `postgresql`

1. Atualizar `prisma/schema.prisma`
2. Criar migration `add_base64_storage`
3. Testar migration em banco de desenvolvimento

**Arquivos:**
- `prisma/schema.prisma`
- `prisma/migrations/.../migration.sql`

**Estimativa:** 30 minutos

---

### FASE 2: Backend - Utils e Helpers

**Responsável:** `backend-specialist`
**Skills:** `nodejs-backend-patterns`, `typescript-expert`, `clean-code`

1. Criar `server/utils/base64.ts`:
   ```typescript
   export function bufferToBase64(buffer: Buffer): string
   export function base64ToBuffer(base64: string): Buffer
   export function getMimeType(buffer: Buffer): string
   export function createDataUrl(base64: string, mimeType: string): string
   ```

2. Criar `server/utils/file-storage.ts`:
   ```typescript
   export async function saveImageToDb(buffer: Buffer, sceneId: string)
   export async function saveAudioToDb(buffer: Buffer, videoId: string)
   export async function saveVideoToDb(buffer: Buffer, videoId: string)
   ```

**Arquivos:**
- `server/utils/base64.ts` (novo)
- `server/utils/file-storage.ts` (novo)

**Estimativa:** 45 minutos

---

### FASE 3: Backend - Pipeline Service

**Responsável:** `backend-specialist`
**Skills:** `nodejs-backend-patterns`, `error-handling-patterns`, `architecture-patterns`

**Modificações:**

1. **generateImages():**
   ```typescript
   // ANTES:
   await fs.writeFile(imagePath, image.buffer)
   await prisma.sceneImage.create({
     filePath: imagePath,
     fileSize: image.buffer.length
   })
   
   // DEPOIS:
   const base64 = bufferToBase64(image.buffer)
   const mimeType = getMimeType(image.buffer)
   await prisma.sceneImage.create({
     fileData: base64,
     mimeType: mimeType
   })
   ```

2. **generateAudio():**
   - Similar ao generateImages
   - Salvar base64 em AudioTrack

3. **generateMotion():**
   - Similar ao generateImages
   - Salvar base64 em SceneVideo

4. **renderVideo():**
   - Salvar base64 em Video.outputData
   - Remover criação de arquivo final

**Arquivos:**
- `server/services/pipeline/video-pipeline.service.ts`

**Estimativa:** 2 horas

---

### FASE 4: Backend - API Endpoints

**Responsável:** `backend-specialist`
**Skills:** `api-patterns`, `api-design-principles`, `nextjs-app-router-patterns`

**Novos Endpoints:**

1. `GET /api/videos/[id]/download`
   ```typescript
   // Retorna vídeo como stream ou data URL
   const video = await prisma.video.findUnique({ where: { id } })
   const buffer = base64ToBuffer(video.outputData)
   return new Response(buffer, {
     headers: { 'Content-Type': video.outputMimeType }
   })
   ```

2. `GET /api/scenes/[id]/image`
3. `GET /api/scenes/[id]/audio`
4. `GET /api/scenes/[id]/video`

**Arquivos:**
- `server/api/videos/[id]/download.get.ts` (novo)
- `server/api/scenes/[id]/image.get.ts` (novo)
- `server/api/scenes/[id]/audio.get.ts` (novo)
- `server/api/scenes/[id]/video.get.ts` (novo)

**Estimativa:** 1 hora

---

### FASE 5: Frontend - Componentes

**Responsável:** `frontend-specialist`
**Skills:** `react-patterns`, `react-ui-patterns`, `frontend-design`

**Modificações:**

1. **VideoPlayer.vue:**
   ```vue
   <video :src="`data:${video.outputMimeType};base64,${video.outputData}`" />
   ```

2. **SceneImage display:**
   ```vue
   <img :src="`data:${image.mimeType};base64,${image.fileData}`" />
   ```

3. **AudioPlayer (se existir):**
   ```vue
   <audio :src="`data:${audio.mimeType};base64,${audio.fileData}`" />
   ```

**Arquivos:**
- Componentes que exibem mídia (identificar via grep)

**Estimativa:** 1 hora

---

### FASE 6: Migração de Dados Existentes

**Responsável:** `devops-engineer`
**Skills:** `bash-pro`, `deployment-procedures`, `database-optimizer`

**Script de Migração:**

```typescript
// scripts/migrate-files-to-db.ts
// 1. Ler todos os registros com filePath
// 2. Ler arquivo do disco
// 3. Converter para base64
// 4. Atualizar registro no banco
// 5. (Opcional) Deletar arquivo do disco
```

**Arquivos:**
- `scripts/migrate-files-to-db.ts` (novo)

**Estimativa:** 1 hora

---

### FASE 7: Testes

**Responsável:** `test-engineer`
**Skills:** `testing-patterns`, `javascript-testing-patterns`, `e2e-testing-patterns`

**Testes a Criar:**

1. **Unit Tests:**
   - `base64.test.ts` - Encode/decode
   - `file-storage.test.ts` - Save/retrieve

2. **Integration Tests:**
   - Criar vídeo → verificar base64 salvo
   - Buscar vídeo → verificar decodificação

3. **E2E Tests:**
   - Pipeline completo → verificar mídia renderiza

**Arquivos:**
- `server/utils/__tests__/base64.test.ts` (novo)
- `server/api/__tests__/video-download.test.ts` (novo)

**Estimativa:** 2 horas

---

### FASE 8: Limpeza e Documentação

**Responsável:** `documentation-writer`
**Skills:** `documentation-templates`, `api-documentation-generator`, `readme`

1. Atualizar README com nova arquitetura
2. Documentar endpoints de download
3. Adicionar comentários no código
4. Criar guia de migração

**Arquivos:**
- `README.md`
- `docs/STORAGE_ARCHITECTURE.md` (novo)

**Estimativa:** 30 minutos

---

## ⚠️ Riscos e Mitigações

### Risco 1: Tamanho do Banco de Dados
**Impacto:** Base64 aumenta tamanho em ~33%
**Mitigação:** 
- Monitorar tamanho do banco
- Considerar compressão (gzip) antes de base64
- Avaliar limite de vídeos por usuário

### Risco 2: Performance de Queries
**Impacto:** Carregar base64 em queries pode ser lento
**Mitigação:**
- Usar `select` específico (não carregar fileData em listas)
- Criar endpoints dedicados para download
- Implementar cache no frontend

### Risco 3: Limite de Tamanho de Campo
**Impacto:** PostgreSQL TEXT tem limite teórico de 1GB
**Mitigação:**
- Vídeos grandes podem exceder
- Considerar chunking ou BYTEA em vez de TEXT
- Limitar duração/resolução de vídeos

### Risco 4: Dados Existentes
**Impacto:** Arquivos já salvos em disco
**Mitigação:**
- Script de migração (FASE 6)
- Manter compatibilidade temporária (fallback)
- Backup antes de migrar

---

## 📦 Entregáveis

- [ ] Migration do Prisma
- [ ] Utils de base64
- [ ] Pipeline atualizado
- [ ] Endpoints de download
- [ ] Frontend atualizado
- [ ] Script de migração
- [ ] Testes
- [ ] Documentação

---

## 🚀 Ordem de Execução

1. **database-architect** → Schema + Migration
2. **backend-specialist** → Utils + Pipeline + API
3. **frontend-specialist** → Componentes
4. **devops-engineer** → Script de migração
5. **test-engineer** → Testes
6. **documentation-writer** → Docs

---

## 📊 Estimativa Total

| Fase | Tempo |
|------|-------|
| Database | 30min |
| Utils | 45min |
| Pipeline | 2h |
| API | 1h |
| Frontend | 1h |
| Migração | 1h |
| Testes | 2h |
| Docs | 30min |
| **TOTAL** | **~8.75 horas** |

---

## ✅ Critérios de Aceitação

1. ✅ Nenhum arquivo de mídia salvo em disco
2. ✅ Todos os arquivos em base64 no banco
3. ✅ Vídeos renderizam corretamente no frontend
4. ✅ Imagens renderizam corretamente
5. ✅ Áudios tocam corretamente
6. ✅ Dados existentes migrados
7. ✅ Testes passando
8. ✅ Documentação atualizada

---

**Plano criado por:** Orchestrator + Project Planner
**Data:** 2026-02-03
**Status:** Aguardando aprovação do usuário
