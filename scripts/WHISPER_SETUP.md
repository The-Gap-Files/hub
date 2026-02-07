# 🎙️ Whisper Local - Guia de Instalação

## ✅ INSTALAÇÃO CONCLUÍDA!

O Whisper já está instalado e funcionando! 🎉

---

## 📋 O Que Foi Instalado

- ✅ **openai-whisper** (versão oficial do OpenAI)
- ✅ **PyTorch** (framework de deep learning)
- ✅ **tiktoken** (tokenizador)
- ✅ **numba** (aceleração numérica)

---

## 🚀 Como Usar

### Opção 1: Via Interface (Recomendado)

1. Renderizar vídeo normalmente
2. Clicar em **"INSERIR LEGENDA"**
3. Escolher estilo (TikTok, YouTube Shorts, YouTube Long)
4. Aguardar processamento (1-5 min)
5. Pronto! Vídeo com legendas aparece automaticamente

### Opção 2: Testar Script Manualmente

```bash
# Criar um vídeo de teste (ou usar um existente)
python scripts/whisper_transcribe.py "caminho/do/video.mp4" medium pt
```

---

## 📊 Performance Esperada

| Hardware | Modelo | Tempo (30s vídeo) | Tempo (3min vídeo) |
|----------|--------|-------------------|---------------------|
| **GPU NVIDIA (RTX 3060+)** | medium | 30-60s | 3-6 min |
| **CPU (i7/Ryzen 7)** | medium | 3-5 min | 18-30 min |
| **CPU (i5/Ryzen 5)** | medium | 4-6 min | 24-36 min |

---

## 🎯 Modelos Disponíveis

| Modelo | Tamanho | Precisão | Velocidade | Uso |
|--------|---------|----------|------------|-----|
| **tiny** | ~75MB | 70% | Muito rápida | Testes |
| **base** | ~150MB | 75% | Rápida | Testes |
| **small** | ~500MB | 85% | Média | Produção rápida |
| **medium** | ~1.5GB | 90% | ⭐ **Padrão** | **Recomendado** |
| **large** | ~3GB | 95% | Lenta | Máxima precisão |

**Padrão atual:** `medium` (melhor custo-benefício)

---

## 💡 Dicas de Uso

### 1. Primeira Execução
Na primeira vez que usar, o Whisper vai **baixar o modelo** (~1.5GB para medium).  
Isso acontece automaticamente e demora ~2-5 minutos dependendo da internet.

### 2. GPU vs CPU
- **Com GPU NVIDIA:** 5-10x mais rápido
- **Sem GPU:** Funciona normalmente, apenas mais lento

### 3. Idiomas Suportados
- Português (pt) ✅
- Inglês (en) ✅
- Espanhol (es) ✅
- Francês (fr) ✅
- +90 outros idiomas

---

## 🔧 Troubleshooting

### Erro: "No module named 'whisper'"
```bash
# Reinstalar
pip install -U openai-whisper
```

### Erro: "CUDA not available"
**Não é um erro!** Significa que vai usar CPU.  
Para usar GPU, você precisa:
1. GPU NVIDIA
2. CUDA Toolkit instalado
3. PyTorch com suporte CUDA

### Processamento Muito Lento
- Use modelo `small` ao invés de `medium`
- Ou instale CUDA para usar GPU

### Erro: "ffmpeg not found"
O Whisper precisa do FFmpeg para extrair áudio.  
Já está instalado no projeto via `@ffmpeg-installer/ffmpeg`.

---

## 🎊 Pronto para Usar!

Agora é só:
1. Renderizar um vídeo
2. Clicar em "INSERIR LEGENDA"
3. Escolher o estilo
4. Aguardar
5. Aproveitar! 🚀

---

## 📝 Notas Técnicas

- **Primeira execução:** Baixa modelo (~1.5GB)
- **Cache:** Modelos ficam em `~/.cache/whisper/`
- **Formatos:** Suporta MP4, AVI, MOV, MKV, etc
- **Áudio:** Extrai automaticamente do vídeo
- **Precisão:** 90-95% em português
- **Timestamps:** Palavra por palavra

---

## 💰 Economia

Comparado ao ElevenLabs:

| Aspecto | ElevenLabs | Whisper Local |
|---------|------------|---------------|
| **Custo por vídeo (30s)** | $0.15 | ✅ **$0.00** |
| **Custo por vídeo (3min)** | $0.90 | ✅ **$0.00** |
| **Custo mensal (100 vídeos)** | $15-90 | ✅ **$0.00** |

**Economia anual:** $180-1080 💰

---

## 🆘 Suporte

Se tiver problemas:
1. Verificar que Python 3.8+ está instalado
2. Verificar que openai-whisper está instalado (`pip list | grep whisper`)
3. Tentar modelo menor (`small` ao invés de `medium`)
4. Verificar espaço em disco (3GB+ livre)

**Tudo funcionando?** Então é só usar! 🎉
