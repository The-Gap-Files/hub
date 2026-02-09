# Fluxo Dossier → Outputs e relacionamento de constantes

Análise do fluxo desde a criação do dossier até a geração de outputs, incluindo campos informados e uso das constantes (intelligence-classifications, script-styles, visual-styles). Alinhado a enhance + product-owner + ui-ux-pro-max.

---

## 1. Criação do Dossier

| Onde | Campos | Constantes usadas |
|------|--------|-------------------|
| **API** | `POST /api/dossiers` | Nenhuma (dossier não tem classificação) |
| **Payload** | title, sourceText, theme, tags, visualIdentityContext, preferredVisualStyleId, preferredSeedId | Visual styles (ID), Seeds (ID) como preferência global do dossier |

**Relacionamentos:** O dossier guarda apenas **preferências** (preferredVisualStyleId, preferredSeedId). Essas preferências são usadas como **fallback** ao criar outputs quando o usuário não escolhe estilo visual/seed no modal.

---

## 2. Iniciar Produção (modal) — criação de outputs

| Passo | Nome | Campo enviado | Constante | Relacionamento recomendado |
|-------|------|----------------|-----------|----------------------------|
| 01 | Classificação (tema) | classificationId | intelligence-classifications | **Pai** → define script e visual recomendados |
| 02 | Dimensões & Formatos | outputType, format, duration, aspectRatio, platform | video-formats | — |
| 03 | Narrativa | scriptStyleId | script-styles | **Filho** do pai (recomendado por classification.defaultScriptStyleId) |
| 04 | Direção Visual | visualStyleId | visual-styles | **Neto** (recomendado por script.defaultVisualStyleId); fallback: dossier.preferredVisualStyleId |
| 05 | Inteligência Adicional | enableMotion, targetWPM, voiceId, objective | editorial-objectives, voices | — |

**Hierarquia Pai → Filho → Neto:**
- **Classification** (pai): cada item tem `defaultScriptStyleId`.
- **Script** (filho): cada item tem `defaultVisualStyleId`.
- **Visual** (neto): folha da árvore.

---

## 3. Backend ao criar outputs (`POST /api/dossiers/:id/outputs`)

Ordem de resolução (já implementada):

1. `classificationId` = enviado pelo frontend.
2. `scriptStyleId` = enviado **ou** `classification.defaultScriptStyleId` se não enviado.
3. `visualStyleId` = enviado **ou** `dossier.preferredVisualStyleId` **ou** `scriptStyle.defaultVisualStyleId`.
4. `seedId` = enviado **ou** `dossier.preferredSeedId` **ou** gerado se houver visualStyle e não houver seed.

**Conclusão:** Os relacionamentos recomendados **já são usados no backend** quando o frontend omite script/visual (defaults são aplicados). Porém o frontend hoje **sempre envia** scriptStyleId e visualStyleId (valores padrão da lista), então o backend raramente aplica os defaults da classificação — a menos que o frontend passe a **não enviar** script/visual quando o usuário escolhe uma classificação e aceita “usar recomendados”.

---

## 4. Uso das recomendações no frontend (implementado)

| Lacuna | Descrição | Impacto |
|--------|-----------|---------|
| **Frontend não prefilla** | Ao selecionar uma classificação, Narrativa e Direção Visual não são atualizados para os recomendados (defaultScriptStyleId, defaultVisualStyleId). | Usuário pode deixar “Documentário” + “Epictok” mesmo tendo escolhido True Crime (recomendado: Documentário + Ghibli Sombrio). |
| **Sem badge “Recomendado”** | Nas listas de Narrativa e Direção Visual não há indicação de qual opção é a recomendada para a classificação escolhida. | Dificulta seguir a hierarquia pai → filho → neto na interface. |
| **Ordem fixa de defaults** | loadStyles() define script = primeiro da lista, visual = preferredVisualStyleId ou primeiro. Não considera classificação. | Ao abrir o modal, mesmo com intenção de usar True Crime, aparece outro combo até o usuário clicar na classificação. |

---

## 5. Melhorias recomendadas (Product Owner + UI/UX Pro Max)

### 5.1 Usar relacionamentos recomendados no frontend (Must)
- Ao **selecionar uma classificação**, atualizar automaticamente:
  - **Narrativa** = `classification.defaultScriptStyleId` (se existir).
  - **Direção Visual** = `scriptStyle.defaultVisualStyleId` do script acima (se existir); senão manter dossier.preferredVisualStyleId ou atual.
- Exibir badge **“Recomendado”** (ou ícone) nas opções de Narrativa e Direção Visual que forem as recomendadas para a classificação atual.
- Opcional: botão “Usar recomendados para [Classificação]” se o usuário tiver mudado manualmente.

### 5.2 Consistência de labels e ordem (Should)
- Manter ordem **01 Classificação → 02 Formatos → 03 Narrativa → 04 Visual → 05 Inteligência**, reforçando que classificação é o “pai”.
- Labels claros: “Classificação (tema)”, “Estilo de roteiro”, “Estilo visual”, evitando só “Narrativa”/“Direção” sem contexto.

### 5.3 Feedback e acessibilidade (Should)
- Cursor pointer e hover em todos os botões de seleção (já em uso).
- Transições suaves (transition-colors duration-200).
- Texto de apoio em cada passo (ex.: “Define o tom e a orientação (música, visual, narrativa). Opcional.”).

### 5.4 Rastreabilidade (Could) — Feito
- Na listagem de outputs (cards), exibir classificação + script + visual (já feito em parte; garantir que classification apareça quando houver).
- No resumo do modal antes de “Iniciar”, mostrar: “Serão criados N outputs com: Classificação X, Roteiro Y, Visual Z.”

---

## 6. Resumo: estamos usando os relacionamentos?

| Camada | Usa recomendações? | Observação |
|--------|--------------------|------------|
| **Constantes (dados)** | Sim | defaultScriptStyleId e defaultVisualStyleId definidos em cada item. |
| **Backend (outputs)** | Sim | Aplica defaults quando scriptStyleId/visualStyleId não vêm no payload. |
| **Frontend (modal)** | Sim | Prefill ao escolher classificação; badge Recomendado em Estilo de roteiro e Estilo visual. |

**Status:** Frontend usa os relacionamentos recomendados (prefill + badge). Fluxo dossier → outputs alinhado à hierarquia Pai → Filho → Neto.