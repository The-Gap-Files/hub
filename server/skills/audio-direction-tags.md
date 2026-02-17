
# 🎚️ AUDIO DIRECTION TAGS (ELEVENLABS SSML STANDARD)

Referência técnica para controle de prosódia, pausas e entonação em roteiros gerados para síntese vocal (ElevenLabs v2/v2.5/v3 Turbo).

## 1. PAUSAS E SILÊNCIO (A Alma da Narrativa)
O silêncio é a ferramenta mais poderosa do suspense. Use tags de quebra para controlar o ritmo.

| Intenção Narrativa | Tag Obrigatória | Descrição |
| :--- | :--- | :--- |
| **Micro-pausa** (Respiro) | `<break time="0.3s" />` | Pausa natural entre orações ou listas rápidas. |
| **Ênfase Padrão** (Ponto) | `<break time="0.75s" />` | Pausa firme de final de frase. Mais longa que o padrão da IA. |
| **Tensão** (Cliffhanger) | `<break time="1.5s" />` | Pausa dramática antes de uma revelação ou após um hook forte. |
| **Silêncio Absoluto** (Zero) | `<break time="2.5s" />` | Vácuo sonoro para deixar uma imagem ou fato "assentar". Use no fim de Shorts. |

## 2. CONTROLE DE PROSÓDIA (Velocidade e Tom)
A IA tende a ler tudo no mesmo ritmo. Use prosódia para criar dinâmica.

> **Nota:** O suporte a `prosody` varia por modelo. O Turbo v2.5 responde bem a mudanças de *rate*.

| Efeito | Tag | Uso |
| :--- | :--- | :--- |
| **Acelerar** (Urgência) | `<prosody rate="115%">...</prosody>` | Listas rápidas, fugas, momentos de caos. |
| **Desacelerar** (Solenidade) | `<prosody rate="85%">...</prosody>` | Declarações finais, fatos trágicos, revelações lentas. |
| **Sussurro/Baixo** | `<prosody volume="-6dB">...</prosody>` | Segredos, conspirações, intimidade. |
| **Projeção/Alto** | `<prosody volume="+4dB">...</prosody>` | Anúncios públicos, gritos, caos. |

## 3. EXEMPLOS DE APLICAÇÃO (Script Inline)

### Exemplo 1: O Gancho (Hook-Only)
```xml
Ninguém sabe quem assinou o documento.<break time="1.5s" />
Mas todos sabem...<break time="0.5s" /> quem morreu por causa dele.
```

### Exemplo 2: Aceleração e Impacto
```xml
<prosody rate="120%">
Ele correu pelos corredores, ignorou os avisos, quebrou as portas.
</prosody>
<break time="0.5s" />
Mas quando chegou lá... <break time="1.5s" />
<prosody rate="80%">
A sala estava vazia.
</prosody>
```

### Exemplo 3: O Final (Brand Safety)
```xml
O arquivo permanece aberto.<break time="2.0s" />
The Gap Files.
```

## 4. INSTRUÇÕES PARA O ROTEIRISTA
1. **NÃO use reticências (...) para pausas longas.** A IA ignora ou faz pausas curtas demais. Use `<break time="1.0s" />`.
2. **Pausas > Texto:** Em "Mystery", o tempo que você leva *não falando* é tão importante quanto o texto.
3. **Validação:** Se o roteiro tem um bloco de texto de >30 palavras sem nenhuma tag `<break>`, está **REPROVADO** (monótono).
