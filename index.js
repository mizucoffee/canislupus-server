const express = require('express'),
  session = require('express-session'),
  bodyParser = require('body-parser'),
  app = express(),
  http = require('http').Server(app),
  io = require('socket.io')(http),
  uniqid = require('uniqid'),
  QRCode = require('qrcode')

const { db, Player, Game } = require('./mongo')

const sessionMiddleware = session({
  secret: 'canislupus',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true }
})

io.use((socket, next) => sessionMiddleware(socket.request, socket.request.res, next))

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(sessionMiddleware)
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }))
app.use(bodyParser.json({ limit: '100mb' }))
app.use(express.static('./public'))

const server = http.listen(process.env.PORT || 3000, () => console.log("Node.js is listening to PORT:" + server.address().port))

function checkProperty(target, properties) {
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i]
    if (!target.hasOwnProperty(property)) return false
    if (target[property] == null) return false
    if (target[property] == "") return false
  }
  return true
}

const invalidBody = (res) => response(res, null, { code: 400, msg: "Invalid body" })

function response(res, data, error) {
  if (error) return res.status(error.code).json({ ok: false, error })
  res.json({ ok: true, data })
}

app.get('/api/', (req, res) => response(res, { version: 1 }))

app.post('/api/player', async (req, res) => {
  if (req.body == null) return invalidBody(res)
  if (!checkProperty(req.body, ["id", "name", "qr", "verify"])) return invalidBody(res)

  if ((await Player.find({ id: req.body.id })).length) return response(res, null, { code: 400, msg: "Duplicate ID" })

  await new Player({
    name: req.body.name,
    id: req.body.id,
    qr: req.body.qr,
    verify: req.body.verify,
    win: 0,
    lose: 0,
    draw: 0
  }).save()

  response(res, { qr: uniqid() })
})

app.get('/api/player/uniq', async (req, res) => {
  response(res, { qr: uniqid() })
})

app.get('/api/player/qr', async (req, res) => {
  if (!checkProperty(req.query, ["id"])) return invalidBody(res)
  const player = (await Player.findOne({ id: req.query.id }))
  if (player == null) return response(res, null, { code: 404, msg: "Not found" })
  const img = new Buffer((await QRCode.toDataURL(player.qr)).replace(/^data:image\/png;base64,/, ''), 'base64')

  res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': img.length })
  res.end(img)
})

app.post('/api/player/auth', async (req, res) => {
  if (!checkProperty(req.body, ["id", "verify"])) return invalidBody(res)
  const player = (await Player.findOne({ id: req.body.id, verify: req.body.verify }))[0]
  if (player == null) return response(res, null, { code: 400, msg: "Failure" })

  response(res, {
    player: {
      _id: player._id.toString(),
      id: player.id,
      name: player.name,
      win: player.win,
      lose: player.lose,
      draw: player.draw
    }
  })
})

app.post('/api/game/init', async (req, res) => {
  const game = await new Game().save()
  response(res, { game: { id: game._id.toString() } })
})

app.post('/api/game/set', async (req, res) => {
  if (!checkProperty(req.body, ["id"])) return invalidBody(res)
  const game = await Game.findById(req.body.id)
  if (game == null) return response(res, null, { code: 404, msg: "Not found" })

  if (isFinite(Number(req.body.phase))) game.phase = Number(req.body.phase)
  if (req.body.players) game.players = req.body.players
  if (req.body.cards) game.players = req.body.cards
  if (req.body.status) game.status = req.body.status
  if (isFinite(Number(req.body.startTime))) game.startTime = Number(req.body.startTime)
  if (req.body.abilityMessage) game.abilityMessage = req.body.abilityMessage

  await game.save()

  response(res, {
    game
  })
})