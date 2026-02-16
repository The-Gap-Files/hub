#!/usr/bin/env tsx
/**
 * Script one-off: atualiza temperaturas dos LlmAssignments para valores consistentes.
 * story-architect, script, story-validator, script-validator, monetization-validator → 0.5
 */
import 'dotenv/config'
import { prisma } from '../server/utils/prisma'

async function main() {
  const tasks = ['story-architect', 'script', 'story-validator', 'script-validator', 'monetization-validator']

  for (const taskId of tasks) {
    const r = await prisma.llmAssignment.updateMany({
      where: { taskId },
      data: { temperature: 0.5 }
    })
    if (r.count > 0) console.log(`✅ ${taskId} → 0.5`)
  }

  console.log('Concluído.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
