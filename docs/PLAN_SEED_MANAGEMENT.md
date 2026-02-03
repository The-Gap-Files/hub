# Plano de Implementação: Sistema de Gestão de Seeds

## 📋 Contexto

**Objetivo:** Criar um sistema de gestão de Seeds que permite:
1. Criar "receitas visuais" (Seed + Estilo Visual)
2. Rastrear quais vídeos usaram cada seed
3. Reutilizar seeds que geraram bons resultados
4. Migrar criação de vídeo de modal para página dedicada

**Decisões do Usuário:**
- Seed deve estar vinculada obrigatoriamente a um Estilo Visual
- Cada seed tem nome, descrição, categoria, tags para contexto
- Sistema deve mostrar vídeos que usaram cada seed
- Criar vídeo deve ser uma página dedicada (não modal)

---

## 🗂️ Fase 1: Database Schema & Migration

### 1.1 Model Seed
**Arquivo:** `prisma/schema.prisma`

```prisma
model Seed {
  id          String   @id @default(uuid())
  
  // Identificação
  name        String   @db.VarChar(100)
  description String?  @db.Text
  
  // Valor
  value       Int
  
  // Relacionamento OBRIGATÓRIO com estilo visual
  visualStyleId String
  visualStyle   VisualStyle @relation(fields: [visualStyleId], references: [id], onDelete: Cascade)
  
  // Contexto
  category    String?  @db.VarChar(50)
  tags        String?  @db.Text
  
  // Metadados
  usageCount  Int      @default(0)
  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)
  
  // Preview
  previewUrl  String?  @db.VarChar(500)
  
  // Relacionamento com vídeos
  videos      Video[]  @relation("VideoSeed")
  
  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([visualStyleId, value])
  @@index([visualStyleId, isActive])
  @@index([isDefault])
  @@map("seeds")
}
```

### 1.2 Atualizar Model Video
**Arquivo:** `prisma/schema.prisma`

```prisma
model Video {
  // ... campos existentes
  
  // Seed usada
  seedId String?
  seed   Seed?   @relation("VideoSeed", fields: [seedId], references: [id], onDelete: SetNull)
}
```

### 1.3 Atualizar Model VisualStyle
**Arquivo:** `prisma/schema.prisma`

```prisma
model VisualStyle {
  // ... campos existentes
  
  // Relacionamento com seeds
  seeds Seed[]
}
```

### 1.4 Migration
**Comando:** `npx prisma migrate dev --name add_seed_management`

---

## 🔧 Fase 2: Backend API

### 2.1 CRUD de Seeds
**Arquivo:** `server/api/seeds/index.get.ts`
- Listar todas as seeds (com filtros opcionais)
- Query params: `visualStyleId`, `isActive`, `isDefault`

**Arquivo:** `server/api/seeds/index.post.ts`
- Criar nova seed
- Validação: nome, value, visualStyleId obrigatórios
- Auto-incrementar usageCount quando usada

**Arquivo:** `server/api/seeds/[id].get.ts`
- Buscar seed específica
- Incluir: visualStyle, videos relacionados

**Arquivo:** `server/api/seeds/[id].put.ts`
- Atualizar seed
- Validação: não permitir duplicar value no mesmo visualStyle

**Arquivo:** `server/api/seeds/[id].delete.ts`
- Deletar seed
- Soft delete (isActive = false) se tiver vídeos vinculados

### 2.2 Endpoints Auxiliares
**Arquivo:** `server/api/seeds/by-visual-style/[styleId].get.ts`
- Listar seeds de um estilo visual específico
- Ordenar por: isDefault DESC, usageCount DESC

**Arquivo:** `server/api/seeds/[id]/videos.get.ts`
- Listar vídeos que usaram esta seed
- Incluir: título, status, createdAt, thumbnail

### 2.3 Atualizar Pipeline
**Arquivo:** `server/services/pipeline/video-pipeline.service.ts`
- Buscar seed do vídeo
- Passar `seed.value` para Replicate
- Incrementar `usageCount` após uso bem-sucedido

---

## 🎨 Fase 3: Frontend - Gestão de Seeds

### 3.1 Página de Gestão
**Arquivo:** `app/pages/settings/seeds.vue`

**Layout:**
```
┌─────────────────────────────────────┐
│  Seeds                    [+ Novo]  │
├─────────────────────────────────────┤
│  📁 Cyberpunk Neon (3 seeds)       │
│  ├─ 🌟 Seed 1 (Padrão)            │
│  │   [Ver Vídeos] [Editar]        │
│  └─ Seed 2                         │
│      [Ver Vídeos] [Editar]         │
└─────────────────────────────────────┘
```

**Funcionalidades:**
- Listar seeds agrupadas por estilo visual
- Indicar seed padrão com ⭐
- Mostrar usageCount
- Botões: Criar, Editar, Ver Vídeos, Definir como Padrão

### 3.2 Modal Criar/Editar
**Componente:** Modal dentro de `seeds.vue`

**Campos:**
- Nome* (input)
- Descrição (textarea)
- Valor* (number) + botão "Gerar Aleatório"
- Estilo Visual* (select)
- Categoria (input)
- Tags (textarea)
- Ativo (checkbox)
- Definir como padrão (checkbox)

### 3.3 Modal Ver Vídeos
**Componente:** Modal dentro de `seeds.vue`

**Conteúdo:**
- Lista de vídeos que usaram a seed
- Thumbnail, título, data, status
- Link para ver vídeo

---

## 🎬 Fase 4: Frontend - Criar Vídeo

### 4.1 Migrar para Página Dedicada
**Arquivo:** `app/pages/videos/new.vue`

**Motivo:** Modal ficou pequeno, página oferece mais espaço

**Layout:**
```
┌─────────────────────────────────────┐
│  ← Voltar | Criar Novo Vídeo       │
├─────────────────────────────────────┤
│  Tema*                              │
│  [_____________________________]   │
│                                     │
│  Estilo Visual*                     │
│  [Cyberpunk Neon___▼]              │
│                                     │
│  Seed                               │
│  (•) Usar seed padrão              │
│      🌟 Cyberpunk Noturno (1337)  │
│      Usado em 5 vídeos             │
│      [Ver exemplos]                │
│  ( ) Escolher outra seed           │
│      [_______________▼]            │
│  ( ) Aleatório                     │
│                                     │
│  ... outros campos ...             │
│                                     │
│  [Cancelar]        [Criar Vídeo]  │
└─────────────────────────────────────┘
```

### 4.2 Atualizar Index
**Arquivo:** `app/pages/index.vue`

**Mudança:**
- Remover modal de criar vídeo
- Botão "Criar Vídeo" redireciona para `/videos/new`

### 4.3 Atualizar Navegação
**Arquivo:** `app/layouts/default.vue`

**Adicionar:**
- Link para `/videos/new` no menu (se necessário)

---

## 🧪 Fase 5: Testes & Validação

### 5.1 Testes Backend
- Criar seed com sucesso
- Validar unicidade (visualStyleId + value)
- Incrementar usageCount ao usar
- Listar seeds por estilo visual
- Soft delete se tiver vídeos vinculados

### 5.2 Testes Frontend
- Criar seed via UI
- Editar seed existente
- Ver vídeos que usaram seed
- Definir seed como padrão
- Criar vídeo com seed específica

### 5.3 Testes de Integração
- Pipeline usa seed corretamente
- Replicate recebe seed.value
- usageCount incrementa após geração

---

## 📦 Entregáveis

- [ ] Migration aplicada
- [ ] Model Seed criado
- [ ] CRUD API completo
- [ ] Página `/settings/seeds`
- [ ] Página `/videos/new`
- [ ] Pipeline atualizado
- [ ] Testes passando
- [ ] Documentação atualizada

---

## 🚀 Ordem de Execução

1. **Database** (database-architect)
   - Schema + Migration

2. **Backend** (backend-specialist)
   - API endpoints
   - Validações
   - Atualizar pipeline

3. **Frontend** (frontend-specialist)
   - Página de gestão de seeds
   - Página de criar vídeo
   - Atualizar index

4. **Testes** (test-engineer)
   - Testes de integração
   - Validação end-to-end

---

## ⚠️ Riscos & Mitigações

**Risco 1:** Seeds duplicadas no mesmo estilo
**Mitigação:** Constraint unique no banco + validação na API

**Risco 2:** Deletar seed usada em vídeos
**Mitigação:** Soft delete (isActive = false) + onDelete: SetNull

**Risco 3:** Seed padrão não definida
**Mitigação:** Validação: apenas 1 seed pode ser padrão por estilo

---

## 📝 Notas Técnicas

- Seed é um `Int` (número inteiro)
- Range típico: 0 a 2^32-1
- Replicate aceita seed como parâmetro opcional
- Se não passar seed, Replicate gera aleatório
- Salvar seed usado permite reproduzir resultados
