# The Gap Files Hub — Design System

> Gerado via workflow ui-ux-pro-max. Regras de identidade visual e UI.

## Brand

| Elemento | Valor |
|----------|-------|
| Nome | The Gap Files |
| Cor primária | `#FA5401` (orange) |
| Logo | `docs/designer/logo/logo-dark.svg` (1:1, dark theme) |

## Tokens de cor

```css
/* main.css - CSS Variables */
--primary: 20 99% 49%;           /* #FA5401 brand orange */
--primary-foreground: 0 0% 100%;
```

## Regras UI (ui-ux-pro-max)

- **Logo**: Usar logo oficial em SVG, nunca ícone genérico
- **Ícones**: Lucide (lucide-vue-next), tamanho consistente 18–24px
- **Hover**: `transition-colors duration-200`, sem layout shift
- **Dark mode**: Fundo `#050508` / `#0A0A0F`, texto branco/zinc

## Uso no Hub

- Sidebar: logo em `/logo.svg`, alt "The Gap Files"
- Favicon: `/logo.svg` (SVG) + fallback `/favicon.ico`
- Botões primários: `bg-[#FA5401]`, hover `#e54d01`
- **Vídeo (renderização com legendas)**: logo no rodapé direito — coloque `public/logo-footer.png` ou `public/logo.png` (PNG/JPEG; FFmpeg não suporta SVG como overlay). Se não existir, o vídeo sai só com legendas, sem logo.
