const db = require('mongoose'),
  config = require('config'),
  Schema = db.Schema,
  Mixed = Schema.Types.Mixed

db.connect(`mongodb://${config.get('server.mongo')}/canislupus`, { useNewUrlParser: true, useUnifiedTopology: true })

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
  data: String
})

module.exports.db = db
module.exports.Player = Player
module.exports.Game = Game