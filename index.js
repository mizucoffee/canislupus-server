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

io.sockets.on("connection", function (socket) {
  socket.on("join", async function (id) {
    socket.join(id)
    const game = await Game.findById(id)
    io.to(socket.id).emit("game", game.phase, JSON.stringify(game.data))
  })
})

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(sessionMiddleware)
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }))
app.use(bodyParser.json({ limit: '100mb' }))
app.use(express.static('./public'))
app.set('view engine', 'pug')
app.locals.basedir = './views'

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

app.get('/', (req, res) => {
  res.redirect('/login')
})

app.get('/login', (req, res) => {
  res.render('login')
})

app.post('/login-pin', async (req, res) => {
  if (req.body == null) return res.redirect('/login')
  if (!checkProperty(req.body, ["id"])) return res.redirect('/login')

  const player = await Player.findOne({ id: req.body.id })
  if (player == null) return res.render('login-pin', { qr: "", id: "" })
  res.render('login-pin', { qr: player.qr, id: player.id })
})

app.get('/signup', (req, res) => {
  res.render('signup', { qr: uniqid() })
})

app.post('/signup', async (req, res) => {
  if (req.body == null) return res.redirect('/signup#invalid')
  if (!checkProperty(req.body, ["id", "name", "qr", "verify"])) return res.redirect('/signup#invalid')

  if ((await Player.find({ id: req.body.id })).length > 0) return res.redirect('/signup#duplicate')

  const player = new Player({
    name: req.body.name,
    id: req.body.id,
    qr: req.body.qr,
    verify: req.body.verify,
    win: 0,
    lose: 0,
    draw: 0
  })

  await player.save()

  res.redirect('/login#done')
})

app.post("/mypage", async (req, res) => {
  if (!checkProperty(req.body, ["id", "qr", "verify"])) return res.redirect('/login#failed')

  const player = await Player.findOne({ id: req.body.id })
  if (player == null) return res.redirect("/login#failed")
  if (player.verify != req.body.verify) return res.redirect("/login#failed")

  res.render('mypage', { qr: await QRCode.toDataURL(player.qr), name: player.name })
})


app.get('/api/', (req, res) => response(res, { version: 1 }))

app.post('/api/player', async (req, res) => {
  if (req.body == null) return invalidBody(res)
  if (!checkProperty(req.body, ["id", "name", "qr", "verify"])) return invalidBody(res)

  if ((await Player.find({ id: req.body.id })).length) return response(res, null, { code: 400, msg: "Duplicate ID" })

  const player = new Player({
    name: req.body.name,
    id: req.body.id,
    qr: req.body.qr,
    verify: req.body.verify,
    win: 0,
    lose: 0,
    draw: 0
  })
  await player.save()

  response(res, {
    _id: player._id.toString(),
    id: player.id,
    name: player.name,
    win: player.win,
    lose: player.lose,
    draw: player.draw
  })
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
  if (!checkProperty(req.body, ["qr", "verify"])) return invalidBody(res)
  const player = (await Player.findOne({ qr: req.body.qr, verify: req.body.verify }))
  if (player == null) return response(res, null, { code: 400, msg: "Failure" })

  response(res, {
    _id: player._id.toString(),
    id: player.id,
    name: player.name,
    win: player.win,
    lose: player.lose,
    draw: player.draw
  })
})

app.post('/api/player/auth/pin', async (req, res) => {
  if (req.body == null) return res.redirect('/login')
  if (!checkProperty(req.body, ["id"])) return res.redirect('/login')

  const player = await Player.findOne({ id: req.body.id })
  if (player == null) return response(res, { qr: "" })
  response(res, { qr: player.qr })
})

app.post('/api/game/init', async (req, res) => {
  const game = await new Game().save()
  response(res, { id: game._id.toString() })
})

app.post('/api/game/set', async (req, res) => {
  if (!checkProperty(req.body, ["id", "phase", "data"])) return invalidBody(res)
  const game = await Game.findById(req.body.id)
  if (game == null) return response(res, null, { code: 404, msg: "Not found" })

  if (isFinite(Number(req.body.phase))) game.phase = Number(req.body.phase)
  game.data = JSON.parse(req.body.data)
  await game.save()
  io.sockets.in(req.body.id).emit("game", game.phase, JSON.stringify(game.data))

  response(res, game)
})
