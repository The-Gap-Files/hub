# Thumbnail Creation

Cria thumbnails e imagens de capa para YouTube, YouTube Shorts, TikTok e Instagram. Usa o mesmo Replicate/FLUX das imagens de cena (Opção A: gerar N thumbnails, usuário escolhe uma).

## Quando Usar

- Criar thumbnails para YouTube, Shorts, TikTok ou Instagram
- Gerar imagens de capa para vídeos ou previews em redes sociais
- Obter dimensões e specs por plataforma para design de thumbnail

## Dimensões por Plataforma

| Plataforma | Largura × Altura | Aspecto | Formato | Tamanho Máx |
|------------|------------------|---------|---------|-------------|
| **YouTube** | 1280 × 720 | 16:9 | JPG, PNG, GIF | 2 MB |
| **YouTube Shorts** | 1080 × 1920 | 9:16 | JPG, PNG | 5 MB |
| **TikTok** | 1080 × 1920 | 9:16 | JPG, PNG | 5 MB |
| **Instagram Reels** | 1080 × 1920 | 9:16 | JPG, PNG | 5 MB |
| **Instagram Feed** | 1080 × 1080 ou 1080 × 1350 | 1:1 ou 4:5 | JPG, PNG | 5 MB |

### Specs Detalhadas

**YouTube (vídeos normais)**: 1280×720, 16:9, JPG/PNG/GIF, <2MB. Canal precisa verificação por telefone para thumbnail customizado.

**YouTube Shorts / TikTok / Instagram Reels**: 1080×1920, 9:16 (vertical). Cover/thumbnail vertical. TikTok usa frame do vídeo como cover; specs aplicam a imagem criada para frame inicial.

**Instagram Feed**: Quadrado 1080×1080 (1:1) ou vertical 1080×1350 (4:5).

## Fluxo (Replicate/FLUX)

1. **Identificar plataforma** e obter dimensões da tabela.
2. **Montar prompt** com requisitos de thumbnail (contraste, rosto, texto legível).
3. **Chamar Replicate** com dimensões corretas (mesmo provider das cenas).
4. **Salvar/retornar** PNG ou JPG otimizado (compressão se >2MB para YouTube).

## Diretrizes de Prompt para Thumbnails

Incluir no prompt de geração:
- **Contraste alto**: elementos que se destacam em preview pequeno
- **Rosto humano** (quando apropriado): expressões claras, emoção visível
- **Texto**: grande, legível, cores contrastantes (máx 20% da área)
- **Zona segura**: evitar elementos críticos nas bordas (cropping em mobile)
- **Estilo**: chamativo, profissional, coerente com a marca

Exemplo:
```
YouTube thumbnail 1280x720, high contrast, bold text "TITLE HERE", 
person with surprised expression, vibrant colors, professional, 
minimal clutter, eye-catching for small preview
```

## Boas Práticas

- Resolução mínima: 1080px na dimensão menor
- Texto em overlay: ≤ 20% da área
- Branding consistente: filtros e overlays padronizados
- Zona segura: elementos importantes afastados das bordas

## Output

- PNG ou JPG conforme plataforma
- Dimensões exatas conforme tabela
- Arquivo otimizado (compressão se > 2MB para YouTube)
