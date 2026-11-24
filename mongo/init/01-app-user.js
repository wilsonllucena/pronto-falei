// Roda só na primeira subida do Mongo de produção (banco vazio): cria o
// usuário do app com readWrite apenas no banco pronto_falei.
const user = process.env.MONGO_APP_USER
const pwd = process.env.MONGO_APP_PASSWORD
if (!user || !pwd) throw new Error('defina MONGO_APP_USER e MONGO_APP_PASSWORD')
db.getSiblingDB('pronto_falei').createUser({
  user,
  pwd,
  roles: [{ role: 'readWrite', db: 'pronto_falei' }],
})
print(`usuário ${user} criado com readWrite em pronto_falei`)
