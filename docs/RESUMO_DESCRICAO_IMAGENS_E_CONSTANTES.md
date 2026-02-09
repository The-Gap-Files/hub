# Resumo global: descrição das imagens e constantes do projeto

## 1. O que acaba DENTRO do prompt de imagem (o que vai para o modelo)

O prompt enviado ao modelo de imagem (Replicate/FLUX) é:

```
[scene.visualDescription] + ", " + [styleEnhancer do provider]
```

- **scene.visualDescription**: texto que vem **100% do roteiro** (campo `visualDescription` de cada cena). É o prompt principal.
- **styleEnhancer**: sufixo fixo no `replicate-image.provider.ts` (ex.: "cinematic lighting, dramatic composition...") escolhido por `request.style`, que hoje é `output.visualStyle?.baseStyle || 'cinematic'`.

Ou seja: **dentro** do prompt está só o que o **roteiro** gera (visualDescription) + um pequeno enhancer no provider.

---

## 2. Constantes do projeto que influenciam o prompt de imagem

| Constante | Arquivo | O que faz | Entra no roteiro? | Entra direto no prompt de imagem? |
|----------|---------|-----------|-------------------|-----------------------------------|
| **Intelligence classifications** | `intelligence-classifications.ts` | Por tema (true-crime, história, mistério, etc.): `musicGuidance`, `musicMood`, **`visualGuidance`**, **`defaultScriptStyleId`** (pai → filho). Fica no **output** (`output.classificationId`). | ✅ Sim. `visualGuidance` é passado no prompt do roteiro quando há classificação no output. | ❌ Não. O roteiro “traduz” isso em texto no visualDescription. |
| **Visual styles** | `visual-styles.ts` | Estilos (Epictok, GTA6, Cyberpunk, etc.): `baseStyle`, `lightingTags`, `atmosphereTags`, `compositionTags`, `tags` | ⚠️ Parcial (ver lacuna abaixo). Nome e descrição sim; **tags completas só no regenerate-script**, não no pipeline principal. | ❌ Não. Só `output.visualStyle?.baseStyle` é usado como `request.style` → vira o styleEnhancer no provider. |
| **Script styles** | `script-styles.ts` | Estilo narrativo (documentary, mystery, narrative, educational): `description`, `instructions`, **`defaultVisualStyleId`** (filho → neto). | ✅ Sim. `scriptStyleDescription` e `scriptStyleInstructions` no prompt do roteiro. | ❌ Não. Afetam narração e estrutura, não o texto do visualDescription diretamente. |
| **Editorial objectives** | `editorial-objectives.ts` | Objetivo editorial (revelação, cliffhanger, etc.): `instruction` | ✅ Sim. Via `output.objective` → `additionalContext` no prompt do roteiro. | ❌ Não. Impactam a história; o roteiro reflete isso nas cenas e nas descrições. |
| **Wan-prompt-builder** | `wan-prompt-builder.ts` | Gera o bloco "DIRETRIZES VISUAIS OBRIGATÓRIAS" (formato, lighting, atmosphere, composition, prompt completo) | ✅ Sim. Usado **dentro** do script provider quando existem `visualBaseStyle` (e tags). | ❌ Não. É instrução para a LLM escrever o visualDescription. |
| **Caption styles** | `caption-styles.ts` | Estilos de legenda | ❌ Não usados na geração de roteiro/imagem. | ❌ Não. |
| **Video formats** | `video-formats.ts` | Formatos de vídeo | ❌ Não afetam o texto do prompt de imagem. | ❌ Não. |
| **Pricing** | `pricing.ts` | Preços (custo) | ❌ Não afetam conteúdo do prompt. | ❌ Não. |

---

## 3. O que está FORA e deveria estar DENTRO (lacuna)

### 3.1 Tags visuais completas no primeiro roteiro (generateScript) — **corrigido**

- **Onde:** `output-pipeline.service.ts` → `generateScript()` monta o `promptContext` para o roteiro.
- **Correção aplicada:** o pipeline principal agora passa também `visualBaseStyle`, `visualLightingTags`, `visualAtmosphereTags`, `visualCompositionTags`, `visualGeneralTags` (a partir de `output.visualStyle`), alinhado ao que o regenerate-script já faz. Assim o **primeiro** roteiro já recebe o estilo visual completo e pode incorporá-lo no visualDescription.

### 3.2 StyleEnhancer no Replicate provider

- **Onde:** `replicate-image.provider.ts` → `enhancePrompt(basePrompt, style)`.
- **O que faz:** concatena ao prompt um sufixo fixo (ex.: "cinematic lighting, dramatic composition...") conforme `request.style` (que vem de `output.visualStyle?.baseStyle`).
- **Faz sentido estar “fora”?** Hoje o estilo já deveria estar **dentro** do visualDescription (instruímos o roteiro a escrever prompt completo). O enhancer pode ser **redundante** ou até **conflitante** se o roteiro já descreveu o estilo. Faz sentido avaliar: ou (1) remover o enhancer e confiar só no visualDescription, ou (2) manter só como fallback quando não houver estilo rico no texto.

---

## 4. Fluxo resumido (do contexto ao pixel)

```
[Constantes + Dados do output/dossier]
         ↓
  Prompt do Roteiro (LLM)
  - output.classificationId → visualGuidance, musicGuidance, musicMood (intelligence-classifications; classificação está no output)
  - output.visualStyle → nome + descrição (e no regenerate também as tags)
  - scriptStyle, objective, storyOutline, mustInclude/Exclude, etc.
  - wan-prompt-builder (se houver visualBaseStyle) → formato e regras do visualDescription
         ↓
  Script com cenas: cada cena tem visualDescription (texto em inglês, completo)
         ↓
  Geração de imagens: request.prompt = scene.visualDescription
  Provider: enhancePrompt(prompt, style) → prompt + styleEnhancer
         ↓
  Modelo de imagem (FLUX) recebe o prompt final
```

---

## 5. Conclusão: o que está fora precisa estar dentro?

- **Sim, no pipeline principal:** as **tags visuais completas** (baseStyle, lighting, atmosphere, composition, tags) devem ser passadas no **generateScript** do `output-pipeline.service.ts`, como já são no regenerate-script. Assim o primeiro roteiro já produz visualDescription alinhado ao estilo escolhido.
- **Opcional:** revisar o **styleEnhancer** no Replicate provider: se o visualDescription já for “prompt completo”, esse sufixo pode ser removido ou mantido só como fallback leve.

O resto (visualGuidance, script style, objetivo editorial, formato do wan-prompt-builder) já **está** “dentro” no sentido de que entra no **prompt do roteiro** e é refletido no texto que a LLM gera para cada cena; só falta garantir que o **estilo visual completo** também esteja disponível na primeira geração do roteiro.
