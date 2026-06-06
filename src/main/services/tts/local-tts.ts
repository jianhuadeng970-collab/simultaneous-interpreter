import { LanguageCode } from '../../../shared/types'
import { TtsResult } from '../../pipeline/types'
import { TtsService } from './tts-interface'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, mkdirSync } from 'fs'

function getDataDir(): string {
  const base = process.env.APPDATA ||
    (process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Application Support')
      : join(homedir(), '.local', 'share'))
  return join(base, 'simultaneous-interpreter')
}

/**
 * Local TTS service using sherpa-onnx OfflineTts.
 *
 * Model availability:
 *   Chinese (zh) → VITS (csukuangfj/vits-zh-ll, 5 speakers, ~115MB) ✅
 *   English (en) → Piper (en_US-lessac-medium, ~50MB) ✅
 */
export class LocalTtsService implements TtsService {
  private ttsCache: Map<string, unknown> = new Map()
  private modelDir: string
  private packagedModelDir: string

  private sherpa: {
    OfflineTts: new (config: Record<string, unknown>) => {
      generate: (req: { text: string; sid: number; speed: number }) => {
        samples: Float32Array
        sampleRate: number
      }
    }
  } | null = null

  constructor() {
    // UserData path (writable, for downloaded models)
    this.modelDir = join(getDataDir(), 'models', 'tts')
    this.packagedModelDir = join(process.resourcesPath || '', 'models', 'tts')

    if (!existsSync(this.modelDir)) {
      mkdirSync(this.modelDir, { recursive: true })
    }
  }

  /** Resolve a model file path: check userData first, then packaged models */
  private resolvePath(subPath: string): string {
    const userPath = join(this.modelDir, subPath)
    if (existsSync(userPath)) return userPath

    const pkgPath = join(this.packagedModelDir, subPath)
    if (existsSync(pkgPath)) return pkgPath

    // Default to userData path (will trigger error if not found)
    return userPath
  }

  /**
   * Resolve espeak-ng data directory for a given TTS model language.
   * Checks model directories first (bundled), then system paths.
   *
   * Some models have phontab directly in the model dir (e.g. vits-zh-ll).
   * Others have it in an espeak-ng-data/ subdirectory (e.g. Piper en_US).
   */
  private resolveEspeakDataDir(langCode: string): string | null {
    // Priority 1: espeak-ng-data/ subdir in userData model dir
    const userEspeakSub = join(this.modelDir, langCode, 'espeak-ng-data')
    if (existsSync(join(userEspeakSub, 'phontab'))) return userEspeakSub

    // Priority 2: espeak-ng-data/ subdir in packaged model dir
    const pkgEspeakSub = join(this.packagedModelDir, langCode, 'espeak-ng-data')
    if (existsSync(join(pkgEspeakSub, 'phontab'))) return pkgEspeakSub

    // Priority 3: phontab directly in userData model dir (e.g. vits-zh-ll)
    const userDir = join(this.modelDir, langCode)
    if (existsSync(join(userDir, 'phontab'))) return userDir

    // Priority 4: phontab directly in packaged model dir
    const pkgDir = join(this.packagedModelDir, langCode)
    if (existsSync(join(pkgDir, 'phontab'))) return pkgDir

    // Priority 5: System espeak-ng paths (Homebrew, etc.)
    return this.findEspeakDataDir()
  }

  /** Find espeak-ng data directory from system paths */
  private findEspeakDataDir(): string | null {
    // Explicit known paths first
    const knownPaths = [
      '/opt/homebrew/share/espeak-ng-data',
      '/opt/homebrew/Cellar/espeak-ng/1.52.0/share/espeak-ng-data',
      '/opt/homebrew/Cellar/espeak-ng/1.51.0/share/espeak-ng-data',
      '/usr/local/share/espeak-ng-data',
      '/usr/share/espeak-ng-data',
    ]
    for (const p of knownPaths) {
      if (existsSync(join(p, 'phontab'))) return p
    }

    // Dynamic search for versioned Homebrew paths
    const candidates = [
      '/opt/homebrew/Cellar/espeak-ng',
      '/usr/local/Cellar/espeak-ng',
      // Bundled with app (extraResources)
      join(process.resourcesPath, 'espeak-ng-data'),
      join(getDataDir(), 'espeak-ng-data'),
    ]

    for (const base of candidates) {
      if (existsSync(join(base, 'phontab'))) return base
      // Check for versioned Homebrew path
      if (existsSync(base)) {
        const versions = this.readdirSync(base)
        for (const v of versions) {
          const p = join(base, v, 'share', 'espeak-ng-data')
          if (existsSync(join(p, 'phontab'))) return p
        }
      }
    }
    return null
  }

  private readdirSync(dir: string): string[] {
    try {
      const fs = require('fs')
      return fs.readdirSync(dir)
    } catch {
      return []
    }
  }

  setVoice(_language: LanguageCode, _voiceName: string): void {
    // Voice is set via speaker ID for VITS models, config file for Piper
  }

  async synthesize(text: string, language: LanguageCode, speakerId = 0): Promise<TtsResult> {
    if (!this.sherpa) await this.loadSherpa()

    if (language === 'zh') {
      return this.synthesizeZh(text, speakerId)
    } else {
      return this.synthesizeEn(text)
    }
  }

  synthesizeStream(
    text: string,
    language: LanguageCode,
    onAudioChunk: (chunk: Buffer) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): void {
    this.synthesize(text, language)
      .then((result) => {
        onAudioChunk(result.audioBuffer)
        onComplete()
      })
      .catch(onError)
  }

  stop(): void {
    // Non-streaming mode — no state to cancel
  }

  // ========================
  // Chinese TTS (VITS)
  // ========================

  private async synthesizeZh(text: string, speakerId = 0): Promise<TtsResult> {
    const modelPath = this.resolvePath('zh/model.onnx')
    if (!existsSync(modelPath)) {
      throw new Error(
        `Chinese TTS model not found.\n\n` +
        `Download from Settings → Model Setup, or manually:\n` +
        `https://huggingface.co/csukuangfj/sherpa-onnx-vits-zh-ll`
      )
    }

    const tokensPath = this.resolvePath('zh/tokens.txt')
    const lexiconPath = this.resolvePath('zh/lexicon.txt')
    // NOTE: Do NOT pass dataDir for this model.
    // vits-zh-ll uses bopomofo lexicon for phonemization — dataDir's FST
    // files interfere and cause garbled/speed-distorted output.

    try {
      const vitsConfig: Record<string, unknown> = {
        model: modelPath,
        tokens: tokensPath,
        lexicon: lexiconPath,
      }

      // Reuse cached TTS instance if available (avoids ONNX Runtime conflicts)
      const cacheKey = `zh:${speakerId}`
      let tts = this.ttsCache.get(cacheKey) as {
        generate: (req: { text: string; sid: number; speed: number }) => {
          samples: Float32Array
          sampleRate: number
        }
      } | null

      if (!tts) {
        tts = new this.sherpa!.OfflineTts({
          model: {
            vits: vitsConfig,
            numThreads: 2
          }
        }) as unknown as typeof tts
        this.ttsCache.set(cacheKey, tts)
      }

      const result = tts!.generate({
        text,
        sid: speakerId,
        speed: 1.0,
      })
      const wavBuffer = this.float32ToWav(result.samples, result.sampleRate)

      return {
        audioBuffer: wavBuffer,
        format: 'wav',
        sampleRate: result.sampleRate,
        text,
        language: 'zh'
      }
    } catch (error) {
      throw new Error(`VITS TTS synthesis failed: ${error}`)
    }
  }

  // ========================
  // English TTS (Piper)
  // ========================

  private async synthesizeEn(text: string): Promise<TtsResult> {
    const modelName = 'en_US-lessac-medium'
    const modelPath = this.resolvePath(`en/${modelName}.onnx`)
    const tokensPath = this.resolvePath('en/tokens.txt')

    if (!existsSync(modelPath) || !existsSync(tokensPath)) {
      throw new Error(
        `English TTS model not found.\n\n` +
        `Download from Settings → Model Setup, or manually:\n` +
        `https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models`
      )
    }

    // Resolve espeak-ng data dir (Piper model needs phontab for phonemization)
    const dataDir = this.resolveEspeakDataDir('en')
    if (!dataDir) {
      throw new Error(
        `espeak-ng data not found for English TTS.\n\n` +
        `The Piper (en_US-lessac-medium) model requires espeak-ng phoneme data.\n` +
        `Install espeak-ng: brew install espeak-ng\n` +
        `Or copy espeak-ng-data/ directory to the model folder.`
      )
    }

    try {
      // Reuse cached TTS instance
      const cacheKey = 'en:piper'
      let tts = this.ttsCache.get(cacheKey) as {
        generate: (req: { text: string; sid: number; speed: number }) => {
          samples: Float32Array
          sampleRate: number
        }
      } | null

      if (!tts) {
        tts = new this.sherpa!.OfflineTts({
          model: {
            vits: {
              model: modelPath,
              tokens: tokensPath,
              dataDir,
            },
            numThreads: 2
          }
        }) as unknown as typeof tts
        this.ttsCache.set(cacheKey, tts)
      }

      const result = tts!.generate({
        text,
        sid: 0,
        speed: 1.0,
      })
      const wavBuffer = this.float32ToWav(result.samples, result.sampleRate)

      return {
        audioBuffer: wavBuffer,
        format: 'wav',
        sampleRate: result.sampleRate,
        text,
        language: 'en'
      }
    } catch (error) {
      throw new Error(`Piper TTS synthesis failed: ${error}`)
    }
  }

  // ========================
  // Private helpers
  // ========================

  private async loadSherpa(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.sherpa = require('sherpa-onnx-node') as typeof this.sherpa
    } catch {
      const platformPkg = process.platform === 'win32'
        ? 'sherpa-onnx-win-x64'
        : process.platform === 'darwin'
          ? 'sherpa-onnx-darwin-arm64'
          : 'sherpa-onnx-linux-x64'
      throw new Error(
        `sherpa-onnx-node 未正确安装或平台不匹配。\n` +
        `当前平台需要: ${platformPkg}\n` +
        `请确保 Electron 打包时包含了正确的原生模块。`
      )
    }
  }

  private float32ToWav(samples: Float32Array, sampleRate: number): Buffer {
    const numChannels = 1
    const bitsPerSample = 16
    const dataLength = samples.length * 2
    const buffer = Buffer.alloc(44 + dataLength)

    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(36 + dataLength, 4)
    buffer.write('WAVE', 8)
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20)
    buffer.writeUInt16LE(numChannels, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28)
    buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32)
    buffer.writeUInt16LE(bitsPerSample, 34)
    buffer.write('data', 36)
    buffer.writeUInt32LE(dataLength, 40)

    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      const intSample = s < 0 ? s * 0x8000 : s * 0x7fff
      buffer.writeInt16LE(intSample, 44 + i * 2)
    }

    return buffer
  }
}
