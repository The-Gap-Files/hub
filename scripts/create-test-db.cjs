const pg = require('pg')

async function main() {
  // Conectar ao banco 'postgres' para criar o banco de teste
  const pool = new pg.Pool({
    user: 'thegapfiles',
    password: '@B1cv2010@',
    host: 'localhost',
    port: 5432,
    database: 'postgres'
  })

  try {
    const result = await pool.query(`SELECT datname FROM pg_database WHERE datname = 'thegapfile_db_test'`)

    if (result.rows.length > 0) {
      console.log('✅ Banco thegapfile_db_test já existe.')
    } else {
      await pool.query('CREATE DATABASE thegapfile_db_test')
      console.log('✅ Banco thegapfile_db_test criado com sucesso!')
    }
  } catch (e) {
    console.error('❌ Erro:', e.message)
  } finally {
    await pool.end()
  }
}

main()
