/**
 * WebSocket Signaling Server for Simultaneous Interpreter.
 *
 * Handles room creation/joining and relays TTS audio between paired peers.
 * Usage: node src/server/signaling-server.js
 */

const { WebSocketServer } = require('ws')

const PORT = parseInt(process.env.PORT || '9740', 10)

const rooms = new Map()

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 4; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return rooms.has(id) ? generateRoomId() : id
}

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data))
}

function getPeer(room, currentWs) {
  for (const peer of room.peers.values()) {
    if (peer.ws !== currentWs) return peer
  }
  return null
}

// Clean up stale rooms (>1 hour)
setInterval(() => {
  const cutoff = Date.now() - 3600000
  for (const [id, room] of rooms) {
    if (room.createdAt < cutoff) {
      for (const peer of room.peers.values()) send(peer.ws, { type: 'room-closed', message: 'Room expired' })
      rooms.delete(id)
    }
  }
}, 300000)

const wss = new WebSocketServer({ port: PORT })
console.log(`Signaling server: ws://0.0.0.0:${PORT}`)

wss.on('connection', (ws) => {
  let currentRoomId = null

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    switch (msg.type) {
      case 'create-room': {
        const roomId = generateRoomId()
        rooms.set(roomId, {
          id: roomId,
          peers: new Map(),
          createdAt: Date.now()
        })
        rooms.get(roomId).peers.set('p1', { ws, language: msg.language || 'zh', joinedAt: Date.now() })
        currentRoomId = roomId
        send(ws, { type: 'room-created', roomId })
        break
      }

      case 'join-room': {
        const room = rooms.get((msg.roomId || '').toUpperCase())
        if (!room) { send(ws, { type: 'error', message: 'Room not found' }); return }
        if (room.peers.size >= 2) { send(ws, { type: 'error', message: 'Room full' }); return }
        room.peers.set('p2', { ws, language: msg.language || 'en', joinedAt: Date.now() })
        currentRoomId = msg.roomId.toUpperCase()
        send(ws, { type: 'room-joined', roomId: currentRoomId })
        // Notify both
        if (room.peers.size === 2) {
          for (const peer of room.peers.values()) {
            const other = getPeer(room, peer.ws)
            send(peer.ws, { type: 'peer-connected', peerLanguage: other?.language || '?' })
          }
        }
        break
      }

      case 'tts-audio': {
        if (!currentRoomId) return
        const room = rooms.get(currentRoomId)
        if (!room) return
        const peer = getPeer(room, ws)
        if (peer) {
          send(peer.ws, {
            type: 'tts-audio',
            audio: msg.audio,
            format: msg.format || 'wav',
            sampleRate: msg.sampleRate || 16000
          })
        }
        break
      }

      case 'test-text': {
        if (!currentRoomId) return
        const room = rooms.get(currentRoomId)
        if (!room) return
        const peer = getPeer(room, ws)
        if (peer) send(peer.ws, { type: 'test-text', text: msg.text, lang: msg.lang })
        break
      }

      case 'ping':
        send(ws, { type: 'pong' })
        break

      case 'leave-room': {
        if (currentRoomId) {
          const room = rooms.get(currentRoomId)
          if (room) {
            const peer = getPeer(room, ws)
            if (peer) send(peer.ws, { type: 'peer-disconnected' })
            for (const [id, p] of room.peers) { if (p.ws === ws) room.peers.delete(id) }
            if (room.peers.size === 0) rooms.delete(currentRoomId)
          }
          currentRoomId = null
        }
        break
      }
    }
  })

  ws.on('close', () => {
    if (currentRoomId) {
      const room = rooms.get(currentRoomId)
      if (room) {
        const peer = getPeer(room, ws)
        if (peer) send(peer.ws, { type: 'peer-disconnected' })
        for (const [id, p] of room.peers) { if (p.ws === ws) room.peers.delete(id) }
        if (room.peers.size === 0) rooms.delete(currentRoomId)
      }
    }
  })
})

process.on('SIGINT', () => { wss.close(); process.exit(0) })
