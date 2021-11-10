const db = require('mongoose'),
  Schema = db.Schema,
  Mixed = Schema.Types.Mixed

db.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })

const Player = db.model('Player', {
  id: String,
  name: String,
  qr: String,
  verify: String,
  win: Number,
  lose: Number,
  draw: Number
})

const Game = db.model('Game', {
  phase: Number,
  data: Mixed
})

module.exports.db = db
module.exports.Player = Player
module.exports.Game = Game