import { LanguageCode } from '../../../shared/types'
import { AsrResult } from '../../pipeline/types'
import { AsrService } from './asr-interface'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, mkdirSync } from 'fs'
import { getSetting } from '../../config/store'

// Compute model directory without relying on app.getPath (avoid init-time crash)
function getModelDir(): string {
  const base = process.env.APPDATA ||
    (process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Application Support')
      : join(homedir(), '.local', 'share'))
  return join(base, 'simultaneous-interpreter', 'models', 'asr')
}

function getPackageModelDir(): string {
  return join(process.resourcesPath || '', 'models', 'asr')
}

// Dynamic import types for sherpa-onnx-node
interface SherpaModule {
  OfflineRecognizer: new (config: SherpaOfflineConfig) => SherpaOfflineRecognizer
  readWave: (filePath: string) => { samples: Float32Array; sampleRate: number }
}

interface SherpaOfflineRecognizer {
  createStream(): SherpaOfflineStream
  decode(stream: SherpaOfflineStream): void
  getResult(stream: SherpaOfflineStream): { text: string }
  free(): void
}

interface SherpaOfflineStream {
  acceptWaveform(obj: { samples: Float32Array; sampleRate: number }): void
}

interface SherpaOfflineConfig {
  modelConfig: {
    senseVoice?: { model: string; language?: string; useInverseTextNormalization?: number }
    whisper?: { encoder: string; decoder: string; language?: string; task?: string; tailPaddings?: number }
    tokens?: string
    numThreads?: number
    provider?: string
    debug?: number | boolean
  }
}

/**
 * Model configuration per language.
 * All models run locally via sherpa-onnx — no API key needed.
 *
 * Language coverage:
 *   zh (Chinese) → SenseVoice (small, fast, supports zh/en/ja/ko/yue)
 *   th (Thai)    → Whisper large-v3 (99+ languages)
 *   km (Khmer)   → Whisper large-v3 (basic Khmer support)
 */
const MODEL_CONFIGS: Record<LanguageCode, {
  type: 'senseVoice' | 'whisper'
  files: string[]
  description: string
}> = {
  zh: {
    type: 'senseVoice',
    files: ['sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17', 'model.int8.onnx'],
    description: 'SenseVoice int8 (zh/en/ja/ko/yue) — ~229MB'
  },
  en: {
    type: 'senseVoice',  // Same model covers English
    files: ['sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17', 'model.int8.onnx'],
    description: 'SenseVoice int8 (zh/en/ja/ko/yue) — ~229MB'
  }
}

export class LocalAsrService implements AsrService {
  private recognizer: SherpaOfflineRecognizer | null = null
  private accumulatedSamples: Float32Array[] = []
  private currentLanguage: LanguageCode = 'zh'
  private modelDir: string
  private packagedModelDir: string
  private sherpa: SherpaModule | null = null

  constructor() {
    this.modelDir = getModelDir()
    this.packagedModelDir = getPackageModelDir()

    if (!existsSync(this.modelDir)) {
      mkdirSync(this.modelDir, { recursive: true })
    }
  }

  async initialize(language: LanguageCode): Promise<void> {
    this.currentLanguage = language

    // Load sherpa-onnx native addon
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.sherpa = require('sherpa-onnx-node') as SherpaModule
    } catch {
      const platformPkg = process.platform === 'win32'
        ? 'sherpa-onnx-win-x64'
        : process.platform === 'darwin'
          ? `sherpa-onnx-darwin-${process.arch === 'arm64' ? 'arm64' : 'x64'}`
          : 'sherpa-onnx-linux-x64'
      throw new Error(
        `语音识别模块未安装 (${platformPkg})。\n\n` +
        `原因: 当前打包版本未包含 ${process.platform} 平台的原生模块。\n` +
        `解决方法: 在设置中切换 ASR Provider 为 "Azure Cloud"，\n` +
        `或手动安装: 打开终端进入应用目录，执行:\n` +
        `npm install ${platformPkg}`
      )
    }

    const modelConfig = MODEL_CONFIGS[language]
    const modelPaths = this.resolveModelPaths(language)

    // Verify model files exist
    for (const filePath of Object.values(modelPaths)) {
      if (!existsSync(filePath)) {
        throw new Error(
          `模型文件未找到: ${filePath}\n\n` +
          `${modelConfig.description}\n` +
          `请下载模型并放到:\n  ${this.modelDir}/\n\n` +
          `SenseVoice (中文): 在设置中切换为 Azure ASR 可跳过下载\n` +
          `Whisper large-v3: https://huggingface.co/ggerganov/whisper.cpp`
        )
      }
    }

    // Create recognizer based on model type
    this.createRecognizer(language, modelPaths)
    this.accumulatedSamples = []
  }

  recognizeStream(
    pcmChunk: Buffer,
    onResult: (result: AsrResult) => void,
    onError: (error: Error) => void
  ): void {
    try {
      // Convert PCM Int16 → Float32 samples
      const samples = this.bufferToFloat32(pcmChunk)
      this.accumulatedSamples.push(samples)
      // Offline recognizer accumulates audio; we decode on endStream()
    } catch (error) {
      onError(new Error(`Local ASR error: ${error}`))
    }
  }

  setLanguage(language: LanguageCode): void {
    if (language === this.currentLanguage) return
    this.currentLanguage = language
    this.accumulatedSamples = []

    // Recreate recognizer for new language
    const modelPaths = this.resolveModelPaths(language)
    this.createRecognizer(language, modelPaths)
  }

  async endStream(): Promise<AsrResult | null> {
    if (!this.recognizer || !this.sherpa) return null
    if (this.accumulatedSamples.length === 0) return null

    try {
      // Merge all accumulated samples
      const totalLength = this.accumulatedSamples.reduce((sum, arr) => sum + arr.length, 0)
      const merged = new Float32Array(totalLength)
      let offset = 0
      for (const chunk of this.accumulatedSamples) {
        merged.set(chunk, offset)
        offset += chunk.length
      }
      this.accumulatedSamples = []

      // Create stream and feed audio
      const stream = this.recognizer.createStream()
      stream.acceptWaveform({ samples: merged, sampleRate: 16000 })

      // Decode
      this.recognizer.decode(stream)

      // Get result
      const result = this.recognizer.getResult(stream)

      if (result && result.text) {
        return {
          text: result.text.trim(),
          isFinal: true,
          language: this.currentLanguage,
          confidence: 0.85
        }
      }
    } catch (error) {
      console.error('[LocalASR] End stream error:', error)
    }

    return null
  }

  async close(): Promise<void> {
    if (this.recognizer) {
      this.recognizer.free()
      this.recognizer = null
    }
    this.accumulatedSamples = []
  }

  // ========================
  // Private helpers
  // ========================

  /** Resolve a model file path: check userData first, then packaged models */
  private resolvePath(subPath: string): string {
    const userPath = join(this.modelDir, subPath)
    if (existsSync(userPath)) return userPath

    const pkgPath = join(this.packagedModelDir, subPath)
    if (existsSync(pkgPath)) return pkgPath

    // Default to userData path (will trigger error if not found)
    return userPath
  }

  private resolveModelPaths(language: LanguageCode): Record<string, string> {
    const config = MODEL_CONFIGS[language]
    if (config.type === 'senseVoice') {
      const modelSubDir = join(config.files[0], 'model.int8.onnx')
      const fullModelSubDir = join(config.files[0], 'model.onnx')
      const tokensSubPath = join(config.files[0], 'tokens.txt')

      const modelPath = existsSync(this.resolvePath(modelSubDir))
        ? this.resolvePath(modelSubDir)
        : this.resolvePath(fullModelSubDir)
      const tokensPath = this.resolvePath(tokensSubPath)

      return { model: modelPath, tokens: tokensPath }
    } else {
      return {
        encoder: this.resolvePath('large-v3-encoder.int8.onnx'),
        decoder: this.resolvePath('large-v3-decoder.int8.onnx'),
        tokens: this.resolvePath('large-v3-tokens.txt')
      }
    }
  }

  private createRecognizer(
    language: LanguageCode,
    modelPaths: Record<string, string>
  ): void {
    if (!this.sherpa) return

    const configType = MODEL_CONFIGS[language].type

    try {
      if (configType === 'senseVoice') {
        this.recognizer = new this.sherpa.OfflineRecognizer({
          modelConfig: {
            senseVoice: {
              model: modelPaths.model,
              language: language === 'en' ? 'en' : 'zh',
              useInverseTextNormalization: 1
            },
            tokens: modelPaths.tokens,
            numThreads: 2,
            provider: 'cpu'
          }
        })
        console.log(`[LocalASR] SenseVoice recognizer ready (${language})`)
      } else {
        this.recognizer = new this.sherpa.OfflineRecognizer({
          modelConfig: {
            whisper: {
              encoder: modelPaths.encoder,
              decoder: modelPaths.decoder,
              language: language,
              task: 'transcribe',
              tailPaddings: -1
            },
            tokens: modelPaths.tokens,
            numThreads: 2,
            provider: 'cpu'
          }
        })
        console.log(`[LocalASR] Whisper recognizer ready (${language})`)
      }
    } catch (error) {
      console.error('[LocalASR] Failed to create recognizer:', error)
      throw new Error(`本地 ASR 初始化失败: ${error}`)
    }
  }

  private bufferToFloat32(pcmBuffer: Buffer): Float32Array {
    // PCM Int16 → Float32
    const int16Data = new Int16Array(
      pcmBuffer.buffer,
      pcmBuffer.byteOffset,
      pcmBuffer.byteLength / 2
    )
    const float32Data = new Float32Array(int16Data.length)
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 32768.0
    }
    return float32Data
  }
}
