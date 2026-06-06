/**
 * Simultaneous Interpreter — Relay Server
 *
 * A lightweight WebSocket relay for cross-network peer-to-peer connections.
 * Deploy behind nginx/Caddy for TLS termination in production.
 *
 * Usage:
 *   node relay-server.js              # default port 8080
 *   PORT=3000 node relay-server.js     # custom port
 */

const http = require('http')
const { WebSocketServer } = require('ws')
const crypto = require('crypto')

// ── Config ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '8080', 10)
const ROOM_TTL_MS = 10 * 60 * 1000 // rooms expire after 10 minutes
const CLEANUP_INTERVAL_MS = 30_000 // check for stale rooms every 30s
const RATE_LIMIT = { max: 10, windowMs: 60_000 } // 10 room creates per IP per minute

// ── Alphabet for room codes (no I/O/0/1 to avoid confusion) ────────
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

// ── In-memory state ─────────────────────────────────────────────────
/** @type {Map<string, { hostToken: string, guestToken: string|null, hostWs: import('ws').WebSocket|null, guestWs: import('ws').WebSocket|null, createdAt: number }>} */
const rooms = new Map()

/** @type {Map<string, { roomCode: string, role: 'host'|'guest' }>} */
const tokens = new Map()

/** @type {Map<string, { count: number, start: number }>} */
const rateLimitMap = new Map()

// ── Helpers ─────────────────────────────────────────────────────────

function generateCode(len = CODE_LENGTH) {
  let code = ''
  const bytes = crypto.randomBytes(len)
  for (let i = 0; i < len; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return code
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

/** Simple per-IP rate limiter */
function checkRateLimit(ip) {
  const now = Date.now()
  let entry = rateLimitMap.get(ip)
  if (!entry || now - entry.start > RATE_LIMIT.windowMs) {
    entry = { count: 0, start: now }
    rateLimitMap.set(ip, entry)
  }
  entry.count++
  return entry.count <= RATE_LIMIT.max
}

/** Send a JSON control message to a WebSocket */
function sendControl(ws, type, extra = {}) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type, ...extra }))
  }
}

/** Clean up a room and notify remaining peer */
function cleanupRoom(code) {
  const room = rooms.get(code)
  if (!room) return

  if (room.hostWs && room.hostWs.readyState === 1) {
    sendControl(room.hostWs, 'peer-disconnected')
    room.hostWs.close()
  }
  if (room.guestWs && room.guestWs.readyState === 1) {
    sendControl(room.guestWs, 'peer-disconnected')
    room.guestWs.close()
  }

  // Remove tokens
  if (room.hostToken) tokens.delete(room.hostToken)
  if (room.guestToken) tokens.delete(room.guestToken)

  rooms.delete(code)
}

// ── HTTP Server ─────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }))
    return
  }

  // POST /api/rooms — create a room
  if (req.method === 'POST' && req.url === '/api/rooms') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'

    if (!checkRateLimit(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: '请求过于频繁，请稍后再试。Too many requests.' }))
      return
    }

    // Generate a unique room code
    let code = generateCode()
    let attempts = 0
    while (rooms.has(code) && attempts < 10) {
      code = generateCode()
      attempts++
    }
    if (rooms.has(code)) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: '服务器繁忙，请重试。Server busy, try again.' }))
      return
    }

    const hostToken = generateToken()
    rooms.set(code, {
      hostToken,
      guestToken: null,
      hostWs: null,
      guestWs: null,
      createdAt: Date.now()
    })
    tokens.set(hostToken, { roomCode: code, role: 'host' })

    console.log(`[room] ${code} created by ${ip}`)

    res.writeHead(201, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ roomCode: code, hostToken }))
    return
  }

  // POST /api/rooms/:code/join — join a room
  const joinMatch = req.url.match(/^\/api\/rooms\/([A-Z2-9]{6})\/join$/)
  if (req.method === 'POST' && joinMatch) {
    const code = joinMatch[1]
    const room = rooms.get(code)

    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: '房间不存在或已过期。Room not found or expired.',
        code: 'ROOM_NOT_FOUND'
      }))
      return
    }

    if (room.guestToken) {
      res.writeHead(409, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: '房间已满。Room is full.',
        code: 'ROOM_FULL'
      }))
      return
    }

    const guestToken = generateToken()
    room.guestToken = guestToken
    tokens.set(guestToken, { roomCode: code, role: 'guest' })

    console.log(`[room] ${code} joined`)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ roomCode: code, guestToken }))
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

// ── WebSocket Server ────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (url.pathname !== '/ws') {
    socket.destroy()
    return
  }

  const roomCode = url.searchParams.get('room')
  const token = url.searchParams.get('token')

  if (!roomCode || !token) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
    socket.destroy()
    return
  }

  // Validate token
  const tokenInfo = tokens.get(token)
  if (!tokenInfo || tokenInfo.roomCode !== roomCode) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return
  }

  const room = rooms.get(roomCode)
  if (!room) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
    socket.destroy()
    return
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, { roomCode, role: tokenInfo.role, token })
  })
})

wss.on('connection', (ws, _req, info) => {
  const { roomCode, role, token } = info
  const room = rooms.get(roomCode)

  if (!room) {
    ws.close(4000, 'Room not found')
    return
  }

  // Prevent the same token from reconnecting while still connected
  if (role === 'host') {
    if (room.hostWs && room.hostWs.readyState === 1) {
      ws.close(4001, 'Host already connected')
      return
    }
    room.hostWs = ws
    console.log(`[ws] host connected to ${roomCode}`)
  } else {
    if (room.guestWs && room.guestWs.readyState === 1) {
      ws.close(4001, 'Guest already connected')
      return
    }
    room.guestWs = ws
    console.log(`[ws] guest connected to ${roomCode}`)
  }

  // Notify peers
  if (room.hostWs && room.guestWs &&
      room.hostWs.readyState === 1 && room.guestWs.readyState === 1) {
    // Both peers present
    sendControl(room.hostWs, 'peer-joined')
    sendControl(room.guestWs, 'peer-joined')
    console.log(`[room] ${roomCode} paired — relaying`)
  }

  ws.on('message', (data) => {
    // Relay binary data to the other peer
    const isBinary = data instanceof Buffer || data instanceof ArrayBuffer
    const target = role === 'host' ? room.guestWs : room.hostWs

    if (target && target.readyState === 1) {
      if (isBinary) {
        target.send(data)
      }
      // Text messages from clients are ignored — only server sends text (control)
    }
  })

  ws.on('close', (code) => {
    console.log(`[ws] ${role} disconnected from ${roomCode} (code=${code})`)
    // Notify the other peer
    const other = role === 'host' ? room.guestWs : room.hostWs
    sendControl(other, 'peer-disconnected')
    // Clean up the room
    cleanupRoom(roomCode)
  })

  ws.on('error', (err) => {
    console.error(`[ws] error on ${roomCode}/${role}:`, err.message)
  })
})

// ── Periodic cleanup ────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now()
  for (const [code, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      console.log(`[cleanup] expiring room ${code}`)
      cleanupRoom(code)
    }
  }
  // Also clean up stale rate limit entries
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT.windowMs) {
      rateLimitMap.delete(ip)
    }
  }
}, CLEANUP_INTERVAL_MS)

// ── Graceful shutdown ───────────────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('[server] shutting down...')
  for (const code of rooms.keys()) {
    cleanupRoom(code)
  }
  wss.close(() => {
    server.close(() => process.exit(0))
  })
})

process.on('SIGINT', () => {
  console.log('[server] shutting down...')
  for (const code of rooms.keys()) {
    cleanupRoom(code)
  }
  wss.close(() => {
    server.close(() => process.exit(0))
  })
})

// ── Start ───────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[server] Relay server listening on port ${PORT}`)
  console.log(`[server] Health: http://localhost:${PORT}/health`)
  console.log(`[server] Rooms API: POST http://localhost:${PORT}/api/rooms`)
  console.log(`[server] WebSocket: ws://localhost:${PORT}/ws?room=CODE&token=TOKEN`)
})
