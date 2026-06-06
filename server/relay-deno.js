/**
 * Simultaneous Interpreter — Relay Server (Deno Deploy)
 *
 * Deploy to Deno Deploy (free, no credit card, Hong Kong edge):
 *   1. Visit https://dash.deno.com
 *   2. Sign in with GitHub (no credit card needed)
 *   3. New Playground → paste this file
 *   4. Deploy → get URL like https://interpreter-relay.deno.dev
 *
 * Usage:
 *   POST /api/rooms           → { roomCode, hostToken }
 *   POST /api/rooms/:code/join → { guestToken }
 *   GET  /ws?room=CODE&token=TOKEN (WebSocket upgrade)
 */

const ROOM_TTL_MS = 10 * 60 * 1000
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** @type {Map<string, { hostToken: string, guestToken: string|null, hostWs: WebSocket|null, guestWs: WebSocket|null, createdAt: number }>} */
const rooms = new Map()
/** @type {Map<string, { roomCode: string, role: string }>} */
const tokens = new Map()

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return code
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function sendControl(ws, type, extra = {}) {
  try { ws.send(JSON.stringify({ type, ...extra })) } catch (_) {}
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // CORS
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })

  // Health check
  if (req.method === 'GET' && url.pathname === '/health') {
    return new Response(JSON.stringify({ status: 'ok', rooms: rooms.size }), { headers })
  }

  // POST /api/rooms — create a room
  if (req.method === 'POST' && url.pathname === '/api/rooms') {
    let code = generateCode()
    let tries = 0
    while (rooms.has(code) && tries++ < 10) code = generateCode()
    if (rooms.has(code)) return new Response(JSON.stringify({ error: 'Server busy' }), { status: 503, headers })

    const hostToken = generateToken()
    rooms.set(code, { hostToken, guestToken: null, hostWs: null, guestWs: null, createdAt: Date.now() })
    tokens.set(hostToken, { roomCode: code, role: 'host' })

    return new Response(JSON.stringify({ roomCode: code, hostToken }), { status: 201, headers })
  }

  // POST /api/rooms/:code/join — join a room
  const joinMatch = url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})\/join$/)
  if (req.method === 'POST' && joinMatch) {
    const code = joinMatch[1]
    const room = rooms.get(code)
    if (!room) return new Response(JSON.stringify({ error: 'Room not found', code: 'ROOM_NOT_FOUND' }), { status: 404, headers })
    if (room.guestToken) return new Response(JSON.stringify({ error: 'Room full', code: 'ROOM_FULL' }), { status: 409, headers })

    const guestToken = generateToken()
    room.guestToken = guestToken
    tokens.set(guestToken, { roomCode: code, role: 'guest' })

    return new Response(JSON.stringify({ roomCode: code, guestToken }), { status: 200, headers })
  }

  // WebSocket upgrade
  if (url.pathname === '/ws') {
    const roomCode = url.searchParams.get('room')
    const token = url.searchParams.get('token')

    if (!roomCode || !token) return new Response('Bad request', { status: 400 })

    const tokenInfo = tokens.get(token)
    if (!tokenInfo || tokenInfo.roomCode !== roomCode) return new Response('Unauthorized', { status: 401 })

    const room = rooms.get(roomCode)
    if (!room) return new Response('Room not found', { status: 404 })

    const { socket: ws, response } = Deno.upgradeWebSocket(req)
    const role = tokenInfo.role

    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      if (role === 'host') {
        room.hostWs = ws
      } else {
        room.guestWs = ws
      }
      // Both present? Notify
      if (room.hostWs && room.guestWs && room.hostWs.readyState === 1 && room.guestWs.readyState === 1) {
        sendControl(room.hostWs, 'peer-joined')
        sendControl(room.guestWs, 'peer-joined')
      }
    }

    ws.onmessage = (event) => {
      const target = role === 'host' ? room.guestWs : room.hostWs
      if (target && target.readyState === 1 && event.data instanceof ArrayBuffer) {
        target.send(event.data)
      }
    }

    ws.onclose = () => {
      const other = role === 'host' ? room.guestWs : room.hostWs
      sendControl(other, 'peer-disconnected')
      if (other) try { other.close() } catch (_) {}
      if (room.hostToken) tokens.delete(room.hostToken)
      if (room.guestToken) tokens.delete(room.guestToken)
      rooms.delete(roomCode)
    }

    ws.onerror = () => {}

    return response
  }

  return new Response('Not found', { status: 404 })
})

// Cleanup stale rooms every 30s
setInterval(() => {
  const now = Date.now()
  for (const [code, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      sendControl(room.hostWs, 'peer-disconnected')
      sendControl(room.guestWs, 'peer-disconnected')
      rooms.delete(code)
    }
  }
}, 30_000)
