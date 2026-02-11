
import dotenv from 'dotenv'
import { join } from 'path'
import { readFileSync } from 'fs'

// Load .env manually since we are running this script directly
try {
  const envPath = join(process.cwd(), '.env')
  const envConfig = dotenv.parse(readFileSync(envPath))
  for (const k in envConfig) {
    process.env[k] = envConfig[k]
  }
} catch (e) {
  console.error('Error loading .env', e)
}

const key = process.env.GOOGLE_API_KEY
if (!key) {
  console.error('GOOGLE_API_KEY not found')
  process.exit(1)
}

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
  console.log('Fetching:', url)

  try {
    const res = await fetch(url)
    const data = await res.json()

    if (data.models) {
      console.log('--- AVAILABLE MODELS ---')
      data.models.forEach((m: any) => {
        // Filtrag apenas modelos que talvez sejam de imagem ou recentes
        if (m.name.includes('imagen') || m.name.includes('gemini')) {
          console.log(`Name: ${m.name}`)
          console.log(`Methods: ${m.supportedGenerationMethods}`)
          console.log('---')
        }
      })
    } else {
      console.log('No models found or error:', data)
    }
  } catch (err) {
    console.error(err)
  }
}

listModels()
