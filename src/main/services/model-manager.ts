import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, unlinkSync, renameSync, createReadStream } from 'fs'
import { EventEmitter } from 'events'
import https from 'https'
import { createGunzip } from 'zlib'
import { spawn } from 'child_process'
import { pipeline as pipelineAsync } from 'stream/promises'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tarStream = require('tar-stream') as {
  extract: () => NodeJS.WritableStream & {
    on(event: 'entry', listener: (header: { name: string; type: string }, stream: NodeJS.ReadableStream, next: () => void) => void): void
    on(event: 'finish', listener: () => void): void
    on(event: 'error', listener: (err: Error) => void): void
  }
}

// ============================================================
// Model definitions
// ============================================================

export interface ModelInfo {
  id: string
  name: string
  description: string
  /** Human-readable size */
  size: string
  /** Required for core functionality */
  required: boolean
  /** Type of model */
  category: 'asr' | 'tts' | 'translation'
  /** List of files to check/download */
  files: ModelFile[]
  /** For models downloaded as archive: download+extract, then check extracted files */
  downloadArchive?: {
    url: string
    archiveFilename: string
  }
  /** Post-download action */
  postDownload?: 'extract-tarbz2' | 'none'
}

interface ModelFile {
  url: string
  filename: string
  /** Optional SHA256 for integrity check */
  sha256?: string
}

export type ModelStatus = 'not_installed' | 'downloading' | 'installed' | 'error'

export interface ModelProgress {
  modelId: string
  status: ModelStatus
  bytesDownloaded: number
  totalBytes: number
  error?: string
}

// ============================================================
// Model registry
// ============================================================

const ASR_SENSEVOICE_DIR = 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17'

const BASE_URLS = {
  huggingface: 'https://huggingface.co',
  hfMirror: 'https://hf-mirror.com',
  github: 'https://github.com'
}

const MODELS: ModelInfo[] = [
  {
    id: 'asr-sensevoice',
    name: 'ASR: SenseVoice (Chinese/English)',
    description: 'Speech recognition model, supports zh/en/ja/ko/yue',
    size: '~229 MB',
    required: true,
    category: 'asr',
    files: [
      {
        url: `${BASE_URLS.huggingface}/csukuangfj/${ASR_SENSEVOICE_DIR}/resolve/main/model.int8.onnx`,
        filename: `asr/${ASR_SENSEVOICE_DIR}/model.int8.onnx`
      },
      {
        url: `${BASE_URLS.huggingface}/csukuangfj/${ASR_SENSEVOICE_DIR}/resolve/main/tokens.txt`,
        filename: `asr/${ASR_SENSEVOICE_DIR}/tokens.txt`
      }
    ],
    postDownload: 'none'
  },
  {
    id: 'tts-zh-vits',
    name: 'TTS: VITS (Chinese)',
    description: 'Chinese text-to-speech with 5 speakers',
    size: '~115 MB',
    required: true,
    category: 'tts',
    files: [
      {
        url: `${BASE_URLS.huggingface}/csukuangfj/sherpa-onnx-vits-zh-ll/resolve/main/model.onnx`,
        filename: 'tts/zh/model.onnx'
      },
      {
        url: `${BASE_URLS.huggingface}/csukuangfj/sherpa-onnx-vits-zh-ll/resolve/main/tokens.txt`,
        filename: 'tts/zh/tokens.txt'
      },
      {
        url: `${BASE_URLS.huggingface}/csukuangfj/sherpa-onnx-vits-zh-ll/resolve/main/lexicon.txt`,
        filename: 'tts/zh/lexicon.txt'
      },
      {
        url: `${BASE_URLS.huggingface}/csukuangfj/sherpa-onnx-vits-zh-ll/resolve/main/date.fst`,
        filename: 'tts/zh/date.fst'
      },
      {
        url: `${BASE_URLS.huggingface}/csukuangfj/sherpa-onnx-vits-zh-ll/resolve/main/number.fst`,
        filename: 'tts/zh/number.fst'
      },
      {
        url: `${BASE_URLS.huggingface}/csukuangfj/sherpa-onnx-vits-zh-ll/resolve/main/phone.fst`,
        filename: 'tts/zh/phone.fst'
      },
      {
        url: `${BASE_URLS.huggingface}/csukuangfj/sherpa-onnx-vits-zh-ll/resolve/main/new_heteronym.fst`,
        filename: 'tts/zh/new_heteronym.fst'
      },
      {
        url: `${BASE_URLS.huggingface}/csukuangfj/sherpa-onnx-vits-zh-ll/resolve/main/G_multisperaker_latest.json`,
        filename: 'tts/zh/G_multisperaker_latest.json'
      }
    ],
    postDownload: 'none'
  },
  {
    id: 'tts-en-piper',
    name: 'TTS: Piper (English)',
    description: 'English text-to-speech (Lessac Medium voice)',
    size: '~50 MB',
    required: true,
    category: 'tts',
    files: [
      {
        // Download individual files from HuggingFace (bypasses tar extraction issues on Windows)
        url: `${BASE_URLS.huggingface}/csukuangfj/vits-piper-en_US-lessac-medium/resolve/main/en_US-lessac-medium.onnx`,
        filename: 'tts/en/en_US-lessac-medium.onnx'
      },
      {
        url: `${BASE_URLS.huggingface}/csukuangfj/vits-piper-en_US-lessac-medium/resolve/main/tokens.txt`,
        filename: 'tts/en/tokens.txt'
      }
    ],
    postDownload: 'none'
  }
]

// ============================================================
// Model Manager Class
// ============================================================

export class ModelManager extends EventEmitter {
  private modelDir: string
  private packagedModelDir: string
  private downloadStates: Map<string, ModelProgress> = new Map()
  private abortControllers: Map<string, AbortController> = new Map()

  constructor() {
    super()
    this.modelDir = join(app.getPath('userData'), 'models')
    // Packaged models bundled via extraResources
    this.packagedModelDir = join(process.resourcesPath, 'models')

    // Ensure base model directory exists
    if (!existsSync(this.modelDir)) {
      mkdirSync(this.modelDir, { recursive: true })
    }
  }

  /** Get the resolved path for a model relative path (userData > packaged > null) */
  getResolvedPath(relativePath: string): string | null {
    const userPath = join(this.modelDir, relativePath)
    if (existsSync(userPath)) return userPath

    const pkgPath = join(this.packagedModelDir, relativePath)
    if (existsSync(pkgPath)) return pkgPath

    return null
  }

  /** Get the model directory (userData, where downloads go) */
  getModelDir(): string {
    return this.modelDir
  }

  /** Get the packaged model directory (read-only, bundled with app) */
  getPackagedModelDir(): string {
    return this.packagedModelDir
  }

  /** Check if a model is installed (checks userData AND packaged resources) */
  isModelInstalled(modelId: string): boolean {
    const model = MODELS.find((m) => m.id === modelId)
    if (!model) return false

    return model.files.every((f) => {
      return this.getResolvedPath(f.filename) !== null
    })
  }

  /** Get the list of all models with their current status */
  getModelList(): (ModelInfo & { status: ModelStatus })[] {
    return MODELS.map((m) => ({
      ...m,
      status: this.getModelStatus(m.id)
    }))
  }

  /** Get current status of a model */
  getModelStatus(modelId: string): ModelStatus {
    // If currently downloading, return that
    const state = this.downloadStates.get(modelId)
    if (state && state.status === 'downloading') return 'downloading'

    // Check if installed
    if (this.isModelInstalled(modelId)) return 'installed'

    return 'not_installed'
  }

  /** Check if all required models are installed */
  areRequiredModelsInstalled(): boolean {
    return MODELS.filter((m) => m.required).every((m) => this.isModelInstalled(m.id))
  }

  /** Get the absolute path for a model file */
  getModelPath(relativePath: string): string {
    return join(this.modelDir, relativePath)
  }

  /** Download a specific model */
  async downloadModel(modelId: string): Promise<void> {
    const model = MODELS.find((m) => m.id === modelId)
    if (!model) throw new Error(`Unknown model: ${modelId}`)

    if (this.isModelInstalled(modelId)) {
      this.emitProgress(modelId, 'installed', 1, 1)
      return
    }

    const abortController = new AbortController()
    this.abortControllers.set(modelId, abortController)

    try {
      // Ensure target directories exist
      const dirs = new Set<string>()
      for (const file of model.files) {
        dirs.add(join(this.modelDir, file.filename, '..'))
      }
      for (const dir of dirs) {
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      }

      // Calculate total download size (approximate)
      // We estimate based on the model size string for progress
      const totalFiles = model.files.length
      let completedFiles = 0

      this.emitProgress(modelId, 'downloading', 0, totalFiles)

      // If model has a downloadArchive, download and extract that
      if (model.downloadArchive) {
        const archiveDst = join(this.modelDir, model.downloadArchive.archiveFilename)
        const extractDir = join(archiveDst, '..')

        this.emitProgress(modelId, 'downloading', 0, 1)
        await this.downloadFile(model.downloadArchive.url, archiveDst, abortController.signal)

        // Extract
        await this.extractTar(archiveDst, extractDir)
        try { unlinkSync(archiveDst) } catch { /* ignore */ }
        this.emitProgress(modelId, 'downloading', 1, 1)
      } else {
        // Download individual files
        for (const file of model.files) {
          if (abortController.signal.aborted) {
            throw new Error('Download cancelled')
          }

          if (!file.url) continue // Bundled/pre-existing file, skip

          const dst = join(this.modelDir, file.filename)
          await this.downloadFile(file.url, dst, abortController.signal)

          completedFiles++
          this.emitProgress(modelId, 'downloading', completedFiles, totalFiles)
        }
      }

      // Post-download actions (for backward compat)
      if (model.postDownload === 'extract-tarbz2') {
        await this.extractArchives(model)
      }

      this.emitProgress(modelId, 'installed', totalFiles, totalFiles)

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.emitProgress(modelId, 'error', 0, 1, msg)
      throw error
    } finally {
      this.abortControllers.delete(modelId)
    }
  }

  /** Download all required models */
  async downloadAllRequired(): Promise<void> {
    const required = MODELS.filter((m) => m.required && !this.isModelInstalled(m.id))
    for (const model of required) {
      try {
        await this.downloadModel(model.id)
      } catch (error) {
        console.error(`[ModelManager] Failed to download ${model.id}:`, error)
        throw error
      }
    }
  }

  /** Cancel an ongoing download */
  cancelDownload(modelId: string): void {
    const controller = this.abortControllers.get(modelId)
    if (controller) {
      controller.abort()
    }
  }

  // ========================
  // Private helpers
  // ========================

  private emitProgress(
    modelId: string,
    status: ModelStatus,
    bytesDownloaded: number,
    totalBytes: number,
    error?: string
  ): void {
    const progress: ModelProgress = {
      modelId,
      status,
      bytesDownloaded,
      totalBytes,
      ...(error ? { error } : {})
    }
    this.downloadStates.set(modelId, progress)
    this.emit('progress', progress)
  }

  /**
   * Download a file with automatic mirror fallback.
   * Tries hf-mirror.com first (faster in China), then falls back to
   * huggingface.co if mirror fails.
   */
  private async downloadFile(url: string, dest: string, signal: AbortSignal): Promise<void> {
    // Build URL list: mirror first for China accessibility
    const urls: string[] = []

    if (url.includes('huggingface.co')) {
      // Try mirror first (works in China), then original
      urls.push(url.replace('huggingface.co', 'hf-mirror.com'))
      urls.push(url)
    } else {
      urls.push(url)
    }

    let lastError: Error | null = null
    for (const tryUrl of urls) {
      try {
        await this.downloadSingleFile(tryUrl, dest, signal)
        return // success!
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        // Only fall through for network errors (timeout, DNS, etc)
        const msg = lastError.message
        if (msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND') ||
            msg.includes('timed out') || msg.includes('ECONNRESET')) {
          console.warn(`[ModelManager] ${tryUrl} failed (${msg}), trying next mirror...`)
          continue
        }
        throw lastError // Non-network error, don't retry
      }
    }
    throw lastError || new Error(`All mirrors failed for ${url}`)
  }

  private downloadSingleFile(url: string, dest: string, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(dest)

      const onAbort = (): void => {
        file.close()
        try { unlinkSync(dest) } catch { /* ignore */ }
        reject(new Error('Download cancelled'))
      }

      if (signal.aborted) {
        onAbort()
        return
      }

      signal.addEventListener('abort', onAbort, { once: true })

      const req = https.get(url, { signal, timeout: 30000 }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            file.close()
            try { unlinkSync(dest) } catch { /*ignore*/ }
            signal.removeEventListener('abort', onAbort)
            this.downloadSingleFile(redirectUrl, dest, signal).then(resolve).catch(reject)
            return
          }
        }

        if (response.statusCode !== 200) {
          file.close()
          try { unlinkSync(dest) } catch { /* ignore */ }
          reject(new Error(`HTTP ${response.statusCode}: ${url}`))
          return
        }

        // Support gzip-encoded responses
        const contentEncoding = response.headers['content-encoding']
        let stream: NodeJS.ReadableStream = response

        if (contentEncoding === 'gzip') {
          stream = response.pipe(createGunzip())
        }

        pipelineAsync(stream, file)
          .then(() => {
            signal.removeEventListener('abort', onAbort)
            resolve()
          })
          .catch((err: Error) => {
            file.close()
            try { unlinkSync(dest) } catch { /* ignore */ }
            reject(err)
          })
      })

      req.on('timeout', () => {
        req.destroy()
        file.close()
        try { unlinkSync(dest) } catch { /* ignore */ }
        reject(new Error(`ETIMEDOUT: ${url}`))
      })

      req.on('error', (err) => {
        file.close()
        try { unlinkSync(dest) } catch { /* ignore */ }
        reject(err)
      })
    })
  }

  private async extractArchives(model: ModelInfo): Promise<void> {
    // Find and extract tar.bz2 files for this model
    for (const file of model.files) {
      if (file.filename.endsWith('.tar.bz2') || file.filename.endsWith('.tar.gz')) {
        const archivePath = join(this.modelDir, file.filename)
        const extractDir = join(this.modelDir, file.filename, '..')

        if (!existsSync(archivePath)) {
          console.warn(`[ModelManager] Archive not found: ${archivePath}`)
          continue
        }

        try {
          await this.extractTar(archivePath, extractDir)
          // Delete the archive after extraction
          try { unlinkSync(archivePath) } catch { /* ignore */ }
        } catch (error) {
          console.error(`[ModelManager] Extraction failed for ${archivePath}:`, error)
          throw error
        }
      }
    }
  }

  /**
   * Extract a tar archive cross-platform.
   *
   * Primary approach: use system `tar` command (available on macOS, Linux,
   * and Windows 10 build 17063+). Falls back to pure-JS `tar-stream` for
   * .tar.gz files when the tar command is unavailable.
   */
  private extractTar(archivePath: string, extractDir: string): Promise<void> {
    // Primary: try system tar command first (fast, handles all formats)
    return this.extractTarSystem(archivePath, extractDir).catch((sysErr) => {
      console.warn(
        `[ModelManager] System tar failed (${sysErr}), trying JS fallback...`
      )
      // Fallback: pure-JS extraction for .tar.gz
      if (archivePath.endsWith('.gz') || archivePath.endsWith('.tgz')) {
        return this.extractTarJs(archivePath, extractDir)
      }
      // For .tar.bz2, we need the system tar — give a clear error
      throw new Error(
        `无法解压 ${archivePath}。\n` +
        `系统 tar 命令不可用: ${sysErr}\n` +
        `请确保已安装 tar (Windows 10+ 内置支持)。\n` +
        `或手动解压此文件到: ${extractDir}`
      )
    })
  }

  /** Extract using system tar command (macOS, Linux, Windows 10+) */
  private extractTarSystem(archivePath: string, extractDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['-xf', archivePath, '-C', extractDir]
      // Auto-detect compression based on extension
      if (archivePath.endsWith('.bz2')) {
        args.splice(1, 0, '-j')
      } else if (archivePath.endsWith('.gz') || archivePath.endsWith('.tgz')) {
        args.splice(1, 0, '-z')
      }

      const child = spawn('tar', args, { stdio: 'pipe' })
      let stderr = ''

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`tar exited with code ${code}: ${stderr}`))
        }
      })

      child.on('error', (err) => {
        reject(new Error(`Failed to run tar: ${err.message}`))
      })
    })
  }

  /** Pure-JS fallback for .tar.gz files using tar-stream + zlib */
  private extractTarJs(archivePath: string, extractDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const extract = tarStream.extract()
      const completed: Promise<void>[] = []

      extract.on('entry', (header, stream, next) => {
        const outputPath = join(extractDir, header.name)

        // Ensure parent directory exists
        const parentDir = join(outputPath, '..')
        if (!existsSync(parentDir)) {
          mkdirSync(parentDir, { recursive: true })
        }

        if (header.type === 'directory') {
          if (!existsSync(outputPath)) {
            mkdirSync(outputPath, { recursive: true })
          }
          stream.resume() // drain the stream
          next()
          return
        }

        if (header.type === 'file') {
          const writeStream = createWriteStream(outputPath)
          const done = pipelineAsync(stream, writeStream)
          completed.push(done)
          done.then(next).catch(next)
          return
        }

        // For symlinks and other types, skip
        stream.resume()
        next()
      })

      extract.on('finish', () => {
        Promise.all(completed).then(() => resolve()).catch(reject)
      })

      extract.on('error', reject)

      // Pipe the .tar.gz through gunzip → tar-stream
      const readStream = createReadStream(archivePath)
      const gunzip = createGunzip()
      pipelineAsync(readStream, gunzip, extract).catch(reject)
    })
  }
}
