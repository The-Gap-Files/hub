/**
 * Skill Loader
 * 
 * Carrega arquivos .md da pasta server/skills/ e retorna o conteúdo
 * pronto para ser injetado como instructions no system prompt da LLM.
 * 
 * Single Source of Truth: as skills em server/skills/ são a fonte
 * definitiva dos frameworks narrativos. Não existem mais instruções
 * hardcoded no script-styles.ts.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Cache em memória — skills são estáticas, lemos uma vez na 1ª chamada
const skillCache = new Map<string, string>()

/**
 * Resolve o caminho absoluto para a pasta de skills.
 * Funciona tanto em dev (process.cwd() = hub/) quanto em prod (.output/).
 * 
 * IMPORTANTE: Execução é LAZY (chamada apenas quando loadSkill() é invocado)
 * para não causar I/O síncrono durante a inicialização do bundle Nitro.
 * 
 * Usa import.meta.url em vez de __dirname pois o Nitro roda em ESM.
 */
function resolveSkillsDir(): string {
  // ESM-compatible __dirname
  const currentDir = path.dirname(fileURLToPath(import.meta.url))

  // Em produção (Nitro build), o cwd é /app e os arquivos ficam em server/skills/
  // Em dev, o cwd é hub/ e os arquivos ficam em server/skills/
  const candidates = [
    path.resolve(process.cwd(), 'server', 'skills'),           // dev: hub/server/skills/
    path.resolve(process.cwd(), '..', 'server', 'skills'),     // fallback
    path.resolve(currentDir, '..', 'skills'),                   // build relativo
    path.resolve(currentDir, '..', '..', 'server', 'skills'),  // build alternativo
  ]

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir
    }
  }

  // Se nenhum caminho funcionar, retorna o primeiro candidato (vai falhar ao ler, com erro claro)
  console.warn('[SkillLoader] ⚠️ Nenhum diretório de skills encontrado. Candidatos testados:', candidates)
  return candidates[0] as string
}

// Lazy: resolve apenas na primeira chamada, não no top-level
let _skillsDir: string | null = null
function getSkillsDir(): string {
  if (!_skillsDir) {
    _skillsDir = resolveSkillsDir()
  }
  return _skillsDir
}

/**
 * Carrega uma skill pelo nome do arquivo (sem extensão).
 * Remove frontmatter YAML (entre ---) se existir.
 * 
 * @param skillName - Nome do arquivo sem .md (ex: "documentary-storytelling")
 * @returns O conteúdo markdown da skill, pronto para usar como prompt
 * @throws Error se o arquivo não existir
 */
export function loadSkill(skillName: string): string {
  // Retorna do cache se já foi carregado
  const cached = skillCache.get(skillName)
  if (cached) return cached

  const filePath = path.join(getSkillsDir(), `${skillName}.md`)

  if (!fs.existsSync(filePath)) {
    throw new Error(`[SkillLoader] Skill não encontrada: ${filePath}`)
  }

  let content = fs.readFileSync(filePath, 'utf-8')

  // Remove frontmatter YAML (tudo entre --- e ---) se presente
  content = content.replace(/^---[\s\S]*?---\n*/, '')

  // Trim whitespace
  content = content.trim()

  // Cache
  skillCache.set(skillName, content)

  console.log(`[SkillLoader] ✅ Skill "${skillName}" carregada (${content.length} chars)`)

  return content
}

/**
 * Carrega uma skill e prepende um prefixo de identidade.
 * Útil para injetar a persona antes do conteúdo técnico da skill.
 * 
 * @param skillName - Nome do arquivo sem .md
 * @param identityPrefix - Texto de identidade (ex: "Você é um documentarista profissional...")
 * @returns Identidade + conteúdo da skill
 */
export function loadSkillWithIdentity(skillName: string, identityPrefix: string): string {
  const skillContent = loadSkill(skillName)
  return `${identityPrefix}\n\n${skillContent}`
}

/**
 * Lista todas as skills disponíveis na pasta.
 * @returns Array com os nomes das skills (sem extensão)
 */
export function listAvailableSkills(): string[] {
  const dir = getSkillsDir()
  if (!fs.existsSync(dir)) return []

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''))
}

/**
 * Limpa o cache de skills (útil para hot-reload em dev).
 */
export function clearSkillCache(): void {
  skillCache.clear()
  console.log('[SkillLoader] 🗑️ Cache de skills limpo')
}
