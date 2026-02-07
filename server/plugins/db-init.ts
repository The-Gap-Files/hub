/**
 * Plugin de inicialização do banco de dados
 * 
 * Nota: VisualStyles e ScriptStyles foram migrados para constantes estáticas
 * em server/constants/. Não há mais necessidade de seeding no banco.
 */

export default defineNitroPlugin(async (_nitroApp) => {
  console.log('🚀 Database plugin loaded. Styles are now served from constants.')
})
