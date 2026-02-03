# Inicialização Automática do Banco de Dados

## 📋 Visão Geral

O sistema possui um plugin Nitro (`server/plugins/db-init.ts`) que **roda automaticamente** ao iniciar o servidor. Este plugin garante que os dados essenciais existam no banco de dados em qualquer ambiente (desenvolvimento, produção, etc.).

## 🎯 O que é inicializado

### 1. **Estilos Visuais** (5 estilos padrão)
- ✅ Epictok Imersivo
- ✅ GTA 6 Vibes
- ✅ Cyberpunk Neon
- ✅ Pintura a Óleo
- ✅ Fotorrealista

### 2. **Estilos de Roteiro** (4 estilos padrão)
- ✅ Documentário
- ✅ Mistério
- ✅ Narrativo
- ✅ Educacional

## 🚀 Como funciona

1. **Ao iniciar o servidor** (`npm run dev` ou em produção)
2. O plugin verifica se já existem registros no banco
3. **Se não existir nenhum**, cria os registros padrão
4. **Se já existir**, apenas loga a quantidade existente

## 📝 Logs

Ao iniciar, você verá no console:

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

## 🔧 Personalização

Para adicionar ou modificar os dados iniciais, edite o arquivo:
```
server/plugins/db-init.ts
```

Modifique as constantes `VISUAL_STYLES` e `SCRIPT_STYLES` conforme necessário.

## 🌍 Ambientes

Este sistema funciona em **todos os ambientes**:
- ✅ Desenvolvimento local
- ✅ Staging
- ✅ Produção
- ✅ Novos ambientes de desenvolvimento

## ⚠️ Importante

- O plugin usa `skipDuplicates: true`, então é **seguro rodar múltiplas vezes**
- Os IDs são fixos (ex: 'epictok', 'documentary'), garantindo consistência
- Se você deletar todos os registros, eles serão recriados no próximo restart

## 🔄 Forçar Reinicialização

Se precisar recriar os dados padrão:

1. Delete os registros existentes:
```sql
DELETE FROM visual_styles;
DELETE FROM script_styles;
```

2. Reinicie o servidor:
```bash
npm run dev
```

Os dados serão recriados automaticamente! ✨
