/**
 * RelayManager — WebSocket relay-based connection manager.
 *
 * Replaces WebRtcManager. Instead of peer-to-peer WebRTC Data Channels
 * (which fail across firewalls / GFW), this uses a WebSocket relay server
 * that both peers connect to. The server relays binary messages between them.
 *
 * Wire format (identical to WebRtcManager):
 *   Byte 0  | Bytes 1..N  | Meaning
 *   ────────┼──────────────┼────────────
 *   0x00    | WAV audio    | TTS audio chunk for remote peer
 *   0x01    | UTF-8 JSON   | TranscriptData
 *
 * Usage flow:
 *   Host:                        Guest:
 *   const code = await createRoom()
 *   // share code (copy-paste)
 *                                await joinRoom(code)
 *   // both sides: 'connected'!
 */

// ── Types (reused from WebRtcManager) ──────────────────────────────

export type ConnectionState =
  | 'idle'
  | 'creating'
  | 'waiting-answer'
  | 'joining'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

export interface TranscriptData {
  original: string
  translated: string
  sourceLanguage: string
  targetLanguage: string
}

// ── RelayManager ────────────────────────────────────────────────────

export class RelayManager {
  // Public callbacks (same interface as WebRtcManager)
  onStateChange: ((state: ConnectionState) => void) | null = null
  onTtsAudioReceived: ((buffer: ArrayBuffer) => void) | null = null
  onTranscriptReceived: ((data: TranscriptData) => void) | null = null
  onError: ((message: string) => void) | null = null

  private ws: WebSocket | null = null
  private state: ConnectionState = 'idle'
  private relayUrl: string
  private roomCode: string = ''
  private token: string = ''

  /**
   * @param relayUrl - Base URL of the relay server (e.g. "https://relay.example.com").
   *                    The WebSocket URL is derived from this.
   */
  constructor(relayUrl: string) {
    // Strip trailing slash
    this.relayUrl = relayUrl.replace(/\/+$/, '')
  }

  /** Update the relay URL (e.g. after settings change) */
  setRelayUrl(url: string): void {
    this.relayUrl = url.replace(/\/+$/, '')
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Create a room on the relay server. Returns a 6-character room code
   * that the host can share with the guest.
   */
  async createRoom(): Promise<string> {
    if (!this.relayUrl) {
      throw new Error(
        '未配置中继服务器地址。\nRelay server URL is not configured.\n\n' +
        '请在 设置 → Relay Server URL 中配置中继服务器地址。'
      )
    }

    this.setState('creating')

    let response: Response
    try {
      response = await fetch(`${this.relayUrl}/api/rooms`, { method: 'POST' })
    } catch (err) {
      this.setState('error')
      const msg = this.formatNetworkError(err)
      this.emitError(msg)
      throw new Error(msg)
    }

    if (!response.ok) {
      this.setState('error')
      const body = await response.json().catch(() => ({}))
      const msg = body.error || `服务器返回 ${response.status}`
      this.emitError(msg)
      throw new Error(msg)
    }

    const { roomCode, hostToken } = await response.json()
    this.roomCode = roomCode
    this.token = hostToken

    this.connectWebSocket('host')
    this.setState('waiting-answer')
    return roomCode
  }

  /**
   * Join an existing room by its code.
   */
  async joinRoom(code: string): Promise<void> {
    if (!this.relayUrl) {
      throw new Error(
        '未配置中继服务器地址。\nRelay server URL is not configured.\n\n' +
        '请在 设置 → Relay Server URL 中配置中继服务器地址。'
      )
    }

    this.setState('joining')

    let response: Response
    try {
      response = await fetch(`${this.relayUrl}/api/rooms/${code}/join`, { method: 'POST' })
    } catch (err) {
      this.setState('error')
      const msg = this.formatNetworkError(err)
      this.emitError(msg)
      throw new Error(msg)
    }

    if (response.status === 404) {
      this.setState('error')
      const msg = '房间不存在或已过期。\nRoom not found or expired.'
      this.emitError(msg)
      throw new Error(msg)
    }

    if (response.status === 409) {
      this.setState('error')
      const msg = '房间已满。\nRoom is full.'
      this.emitError(msg)
      throw new Error(msg)
    }

    if (!response.ok) {
      this.setState('error')
      const body = await response.json().catch(() => ({}))
      const msg = body.error || `服务器返回 ${response.status}`
      this.emitError(msg)
      throw new Error(msg)
    }

    const { guestToken } = await response.json()
    this.roomCode = code
    this.token = guestToken

    this.connectWebSocket('guest')
  }

  /** Send TTS audio to the remote peer */
  sendTtsAudio(buffer: ArrayBuffer): void {
    this.sendTagged(0x00, buffer)
  }

  /** Send transcript data to the remote peer */
  sendTranscript(data: TranscriptData): void {
    const encoded = new TextEncoder().encode(JSON.stringify(data))
    this.sendTagged(0x01, encoded.buffer)
  }

  /** Check if connected to a peer */
  isConnected(): boolean {
    return this.state === 'connected'
  }

  /** Disconnect from the relay server */
  disconnect(): void {
    this.setState('disconnected')
    if (this.ws) {
      this.ws.close(1000, 'User disconnected')
      this.ws = null
    }
    this.roomCode = ''
    this.token = ''
  }

  // ── Private helpers ──────────────────────────────────────────────

  private connectWebSocket(role: 'host' | 'guest'): void {
    // Derive WebSocket URL: https://host → wss://host; http://host → ws://host
    const wsUrl = this.relayUrl
      .replace(/^https:/, 'wss:')
      .replace(/^http:/, 'ws:')
    const url = `${wsUrl}/ws?room=${this.roomCode}&token=${this.token}`

    try {
      this.ws = new WebSocket(url)
    } catch (err) {
      this.setState('error')
      this.emitError('无法创建 WebSocket 连接。Cannot create WebSocket.')
      return
    }

    this.ws.binaryType = 'arraybuffer'

    this.ws.onopen = () => {
      console.log(`[RelayManager] WebSocket opened as ${role}`)
      if (role === 'guest') {
        this.setState('connected')
      }
      // Host stays in 'waiting-answer' until 'peer-joined' control message
    }

    this.ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        // Control message (JSON text)
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'peer-joined') {
            this.setState('connected')
            console.log('[RelayManager] Peer joined — connected')
          } else if (msg.type === 'peer-disconnected') {
            this.setState('disconnected')
            this.emitError('对方已断开连接。Peer disconnected.')
          }
        } catch {
          // Ignore malformed control messages
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary relayed data — dispatch by type tag
        this.handleIncomingMessage(event.data)
      }
    }

    this.ws.onclose = (event: CloseEvent) => {
      console.log(`[RelayManager] WebSocket closed (code=${event.code})`)
      this.ws = null
      if (this.state === 'disconnected') {
        return // Intentional disconnect — already handled
      }
      if (event.code !== 1000) {
        this.setState('error')
        this.emitError(
          '中继连接断开。\nRelay connection lost.\n\n' +
          '请检查网络后重试。'
        )
      }
    }

    this.ws.onerror = () => {
      // onclose will fire after this — don't double-report
      console.error('[RelayManager] WebSocket error')
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.setState('error')
        this.emitError(
          '无法连接中继服务器。\nCannot reach relay server.\n\n' +
          '💡 请检查：\n' +
          '  1. 中继服务器地址是否正确\n' +
          '  2. 网络连接是否正常\n' +
          '  3. 服务器是否在运行'
        )
      }
    }
  }

  /**
   * Dispatch incoming binary message by type tag.
   * Same logic as WebRtcManager.handleIncomingMessage.
   */
  private handleIncomingMessage(data: ArrayBuffer): void {
    const view = new Uint8Array(data)
    if (view.length < 1) return

    const type = view[0]
    const payload = view.slice(1)

    switch (type) {
      case 0x00: // TTS audio
        this.onTtsAudioReceived?.(
          payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength)
        )
        break
      case 0x01: // Transcript
        try {
          const text = new TextDecoder().decode(payload)
          const parsed = JSON.parse(text) as TranscriptData
          this.onTranscriptReceived?.(parsed)
        } catch {
          // Ignore malformed transcripts
        }
        break
    }
  }

  private sendTagged(tag: number, payload: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const tagged = new Uint8Array(payload.byteLength + 1)
    tagged[0] = tag
    tagged.set(new Uint8Array(payload), 1)
    this.ws.send(tagged.buffer)
  }

  private setState(state: ConnectionState): void {
    this.state = state
    this.onStateChange?.(state)
  }

  private emitError(message: string): void {
    console.error(`[RelayManager] ${message}`)
    this.onError?.(message)
  }

  private formatNetworkError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err)
    const detail = `[DEBUG] URL: ${this.relayUrl}, Error: ${msg}`
    console.error('[RelayManager]', detail)
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
      return `无法连接到中继服务器(${this.relayUrl})\n${msg}\n\n💡 请检查网络。`
    }
    return `网络错误: ${msg}\nNetwork error: ${msg}`
  }
}
