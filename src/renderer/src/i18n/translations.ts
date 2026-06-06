// ============================================================
// UI Translations: 中文 / English / ไทย
// ============================================================

export type UILanguage = 'zh' | 'en' | 'th'

export interface TranslationDict {
  // App header
  appTitle: string
  appSubtitle: string

  // Language names
  langZh: string
  langEn: string
  langTh: string

  // Language selector
  selectLanguage: string
  selectLanguageDesc: string
  confirmLanguage: string

  // Direction
  directionAToB: string
  directionBToA: string
  switchDirection: string

  // Status
  statusIdle: string
  statusListening: string
  statusProcessing: string
  statusPlaying: string
  statusError: string

  // Mic button
  startTranslation: string
  stopTranslation: string

  // Transcript
  transcript: string
  original: string
  translated: string
  noTranscript: string

  // Room / Relay
  roomTitle: string
  createRoom: string
  joinRoom: string
  roomCode: string
  shareCode: string
  copyCode: string
  pasteCode: string
  connected: string
  disconnected: string
  disconnect: string
  waitingPeer: string
  relayConnecting: string
  relayConnected: string
  relayError: string
  relayServerUrl: string
  relayServerUrlDesc: string
  relaySubtitle: string
  relayNotConfigured: string
  relayNotConfiguredDesc: string
  relayConnectedDesc: string
  pasteAndJoin: string
  roomCodePlaceholder: string
  creatingRoom: string
  joiningRoom: string
  establishingConnection: string
  shareCodeToPeer: string
  copied: string
  openSettings: string

  // Settings
  settings: string
  settingsTitle: string
  save: string
  cancel: string
  saving: string
  saved: string
  saveFailed: string

  // Settings sections
  languagePair: string
  ttsVoice: string
  volume: string
  bargeIn: string
  bargeInDesc: string
  modelInfo: string
  modelInfoDesc: string
  allLocal: string

  // Model downloader
  modelSetup: string
  modelSetupDesc: string
  progress: string
  modelsReady: string
  totalSize: string
  required: string
  downloadAll: string
  downloading: string
  preparing: string
  skipForNow: string
  retry: string
  download: string
  allModelsReady: string
  startUsing: string
  modelsStoredLocally: string
  downloadFailed: string

  // ASR/TTS model names
  asrModelName: string
  asrModelDesc: string
  ttsZhModelName: string
  ttsZhModelDesc: string
  ttsEnModelName: string
  ttsEnModelDesc: string

  // Waveform / audio
  listening: string
  speaking: string

  // Misc
  loading: string
  error: string
  ok: string
}

const zh: TranslationDict = {
  appTitle: '同声传译',
  appSubtitle: 'Simultaneous Interpreter',

  langZh: '中文',
  langEn: 'English',
  langTh: 'ภาษาไทย',

  selectLanguage: '选择界面语言',
  selectLanguageDesc: '请选择您偏好的显示语言',
  confirmLanguage: '确认',

  directionAToB: '我说中文 → 对方听到英文',
  directionBToA: '对方说英文 → 我听到中文',
  switchDirection: '切换方向',

  statusIdle: '就绪',
  statusListening: '正在听...',
  statusProcessing: '处理中...',
  statusPlaying: '播放中...',
  statusError: '出错',

  startTranslation: '开始翻译',
  stopTranslation: '停止翻译',

  transcript: '转录',
  original: '原文',
  translated: '译文',
  noTranscript: '开始说话以查看转录...',

  roomTitle: '远程连接',
  createRoom: '创建连接',
  joinRoom: '加入连接',
  roomCode: '房间号',
  shareCode: '将此房间号分享给对方',
  copyCode: '复制',
  pasteCode: '粘贴',
  connected: '已连接',
  disconnected: '未连接',
  disconnect: '断开',
  waitingPeer: '等待对方加入...',
  relayConnecting: '正在连接中继服务器...',
  relayConnected: '已通过中继连接',
  relayError: '中继连接错误',
  relayServerUrl: '中继服务器地址',
  relayServerUrlDesc: 'WebSocket 中继服务器地址。自建服务时可修改。',
  relaySubtitle: 'WebSocket 中继 · 跨网络可用 · TLS 加密',
  relayNotConfigured: '⚠️ 中继服务器未配置',
  relayNotConfiguredDesc: '跨网络连接需要中继服务器。请在设置中配置，或参考 DEPLOY.md 部署自己的中继服务器。',
  relayConnectedDesc: '中继连接已建立 — 翻译结果将发送给对方',
  pasteAndJoin: '📋 粘贴并加入',
  roomCodePlaceholder: '输入 6 位房间号',
  creatingRoom: '正在创建房间...',
  joiningRoom: '正在加入房间...',
  establishingConnection: '正在建立连接...',
  shareCodeToPeer: '📤 将此房间号分享给对方：',
  copied: '✅ 已复制！',
  openSettings: '打开设置',

  settings: '设置',
  settingsTitle: '设置',
  save: '保存',
  cancel: '取消',
  saving: '保存中...',
  saved: '设置已保存',
  saveFailed: '保存失败',

  languagePair: '语言对',
  ttsVoice: 'TTS 声音',
  volume: '音量',
  bargeIn: '打断模式',
  bargeInDesc: '检测到新语音时中断当前播放',
  modelInfo: '模型信息',
  modelInfoDesc: '所有模型本地运行 — 无需 API 密钥。',
  allLocal: '🖥️ 所有模型本地运行 — 无需 API 密钥。',

  modelSetup: 'AI 模型设置',
  modelSetupDesc: '下载所需的 AI 模型以启用离线语音识别和翻译',
  progress: '进度',
  modelsReady: '个模型已就绪',
  totalSize: '约 400 MB 总计',
  required: '必需',
  downloadAll: '下载全部模型',
  downloading: '下载中...',
  preparing: '准备中...',
  skipForNow: '暂时跳过',
  retry: '重试',
  download: '下载',
  allModelsReady: '所有模型已就绪 — 开始使用',
  startUsing: '开始使用',
  modelsStoredLocally: '模型仅需下载一次，之后可离线使用。',
  downloadFailed: '下载失败',

  asrModelName: 'ASR: SenseVoice（中/英文）',
  asrModelDesc: '语音识别模型，支持中/英/日/韩/粤语',
  ttsZhModelName: 'TTS: VITS（中文）',
  ttsZhModelDesc: '中文文字转语音，支持 5 种音色',
  ttsEnModelName: 'TTS: Piper（英文）',
  ttsEnModelDesc: '英文文字转语音（Lessac Medium 音色）',

  listening: '正在听',
  speaking: '正在说',

  loading: '加载中...',
  error: '错误',
  ok: '确定',
}

const en: TranslationDict = {
  appTitle: 'Simultaneous Interpreter',
  appSubtitle: '同声传译',

  langZh: '中文',
  langEn: 'English',
  langTh: 'ภาษาไทย',

  selectLanguage: 'Select Interface Language',
  selectLanguageDesc: 'Choose your preferred display language',
  confirmLanguage: 'Confirm',

  directionAToB: 'I speak Chinese → They hear English',
  directionBToA: 'They speak English → I hear Chinese',
  switchDirection: 'Switch Direction',

  statusIdle: 'Ready',
  statusListening: 'Listening...',
  statusProcessing: 'Processing...',
  statusPlaying: 'Playing...',
  statusError: 'Error',

  startTranslation: 'Start Translation',
  stopTranslation: 'Stop Translation',

  transcript: 'Transcript',
  original: 'Original',
  translated: 'Translation',
  noTranscript: 'Start speaking to see transcript...',

  roomTitle: 'Remote Connection',
  createRoom: 'Create Connection',
  joinRoom: 'Join Connection',
  roomCode: 'Room Code',
  shareCode: 'Share this code with your partner',
  copyCode: 'Copy',
  pasteCode: 'Paste',
  connected: 'Connected',
  disconnected: 'Disconnected',
  disconnect: 'Disconnect',
  waitingPeer: 'Waiting for peer to join...',
  relayConnecting: 'Connecting to relay...',
  relayConnected: 'Connected via relay',
  relayError: 'Relay connection error',
  relayServerUrl: 'Relay Server URL',
  relayServerUrlDesc: 'WebSocket relay server. Change if self-hosting.',
  relaySubtitle: 'WebSocket Relay · Cross-network · TLS Encrypted',
  relayNotConfigured: '⚠️ Relay Server Not Configured',
  relayNotConfiguredDesc: 'A relay server is required for cross-network connections. Configure in Settings or deploy your own (see DEPLOY.md).',
  relayConnectedDesc: 'Relay established — translations will be sent to your partner',
  pasteAndJoin: '📋 Paste & Join',
  roomCodePlaceholder: 'Enter 6-char room code',
  creatingRoom: 'Creating room...',
  joiningRoom: 'Joining room...',
  establishingConnection: 'Establishing connection...',
  shareCodeToPeer: '📤 Share this code with your partner:',
  copied: '✅ Copied!',
  openSettings: 'Open Settings',

  settings: 'Settings',
  settingsTitle: 'Settings',
  save: 'Save',
  cancel: 'Cancel',
  saving: 'Saving...',
  saved: 'Settings saved',
  saveFailed: 'Save failed',

  languagePair: 'Language Pair',
  ttsVoice: 'TTS Voice',
  volume: 'Volume',
  bargeIn: 'Barge-in',
  bargeInDesc: 'Interrupt current playback when new speech is detected',
  modelInfo: 'Model Info',
  modelInfoDesc: 'All models run locally — no API keys required.',
  allLocal: '🖥️ All models run locally — no API keys required.',

  modelSetup: 'AI Model Setup',
  modelSetupDesc: 'Download required AI models to enable offline speech recognition and translation',
  progress: 'Progress',
  modelsReady: 'models ready',
  totalSize: '~400 MB total',
  required: 'REQUIRED',
  downloadAll: 'Download All Models',
  downloading: 'Downloading...',
  preparing: 'Preparing...',
  skipForNow: 'Skip for Now',
  retry: 'Retry',
  download: 'Download',
  allModelsReady: 'All Models Ready — Start Using',
  startUsing: 'Start Using',
  modelsStoredLocally: 'Models are downloaded once and stored locally. Internet connection only required for initial download.',
  downloadFailed: 'Download failed',

  asrModelName: 'ASR: SenseVoice (Chinese/English)',
  asrModelDesc: 'Speech recognition model, supports zh/en/ja/ko/yue',
  ttsZhModelName: 'TTS: VITS (Chinese)',
  ttsZhModelDesc: 'Chinese text-to-speech with 5 speakers',
  ttsEnModelName: 'TTS: Piper (English)',
  ttsEnModelDesc: 'English text-to-speech (Lessac Medium voice)',

  listening: 'Listening',
  speaking: 'Speaking',

  loading: 'Loading...',
  error: 'Error',
  ok: 'OK',
}

const th: TranslationDict = {
  appTitle: 'ล่ามแปลภาษา',
  appSubtitle: '同声传译',

  langZh: '中文',
  langEn: 'English',
  langTh: 'ภาษาไทย',

  selectLanguage: 'เลือกภาษาของอินเทอร์เฟซ',
  selectLanguageDesc: 'กรุณาเลือกภาษาที่ต้องการแสดง',
  confirmLanguage: 'ยืนยัน',

  directionAToB: 'ฉันพูดจีน → พวกเขาได้ยินอังกฤษ',
  directionBToA: 'พวกเขาพูดอังกฤษ → ฉันได้ยินจีน',
  switchDirection: 'สลับทิศทาง',

  statusIdle: 'พร้อม',
  statusListening: 'กำลังฟัง...',
  statusProcessing: 'กำลังประมวลผล...',
  statusPlaying: 'กำลังเล่น...',
  statusError: 'ข้อผิดพลาด',

  startTranslation: 'เริ่มการแปล',
  stopTranslation: 'หยุดการแปล',

  transcript: 'ข้อความถอดเสียง',
  original: 'ต้นฉบับ',
  translated: 'คำแปล',
  noTranscript: 'เริ่มพูดเพื่อดูข้อความถอดเสียง...',

  roomTitle: 'การเชื่อมต่อระยะไกล',
  createRoom: 'สร้างการเชื่อมต่อ',
  joinRoom: 'เข้าร่วมการเชื่อมต่อ',
  roomCode: 'รหัสห้อง',
  shareCode: 'แชร์รหัสนี้กับคู่ของคุณ',
  copyCode: 'คัดลอก',
  pasteCode: 'วาง',
  connected: 'เชื่อมต่อแล้ว',
  disconnected: 'ไม่ได้เชื่อมต่อ',
  disconnect: 'ตัดการเชื่อมต่อ',
  waitingPeer: 'กำลังรอให้อีกฝ่ายเข้าร่วม...',
  relayConnecting: 'กำลังเชื่อมต่อรีเลย์...',
  relayConnected: 'เชื่อมต่อผ่านรีเลย์',
  relayError: 'ข้อผิดพลาดการเชื่อมต่อรีเลย์',
  relayServerUrl: 'URL เซิร์ฟเวอร์รีเลย์',
  relayServerUrlDesc: 'เซิร์ฟเวอร์รีเลย์ WebSocket เปลี่ยนหากโฮสต์เอง',
  relaySubtitle: 'WebSocket รีเลย์ · ข้ามเครือข่าย · เข้ารหัส TLS',
  relayNotConfigured: '⚠️ ไม่ได้กำหนดค่ารีเลย์',
  relayNotConfiguredDesc: 'ต้องใช้เซิร์ฟเวอร์รีเลย์สำหรับการเชื่อมต่อข้ามเครือข่าย กำหนดค่าในการตั้งค่า',
  relayConnectedDesc: 'เชื่อมต่อรีเลย์แล้ว — การแปลจะถูกส่งไปยังคู่ของคุณ',
  pasteAndJoin: '📋 วางและเข้าร่วม',
  roomCodePlaceholder: 'ใส่รหัสห้อง 6 ตัว',
  creatingRoom: 'กำลังสร้างห้อง...',
  joiningRoom: 'กำลังเข้าร่วมห้อง...',
  establishingConnection: 'กำลังสร้างการเชื่อมต่อ...',
  shareCodeToPeer: '📤 แชร์รหัสนี้กับคู่ของคุณ:',
  copied: '✅ คัดลอกแล้ว!',
  openSettings: 'เปิดการตั้งค่า',

  settings: 'ตั้งค่า',
  settingsTitle: 'ตั้งค่า',
  save: 'บันทึก',
  cancel: 'ยกเลิก',
  saving: 'กำลังบันทึก...',
  saved: 'บันทึกการตั้งค่าแล้ว',
  saveFailed: 'การบันทึกล้มเหลว',

  languagePair: 'คู่ภาษา',
  ttsVoice: 'เสียง TTS',
  volume: 'ระดับเสียง',
  bargeIn: 'ขัดจังหวะ',
  bargeInDesc: 'ขัดจังหวะการเล่นปัจจุบันเมื่อตรวจพบเสียงพูดใหม่',
  modelInfo: 'ข้อมูลโมเดล',
  modelInfoDesc: 'โมเดลทั้งหมดทำงานในเครื่อง — ไม่ต้องใช้คีย์ API',
  allLocal: '🖥️ โมเดลทั้งหมดทำงานในเครื่อง — ไม่ต้องใช้คีย์ API',

  modelSetup: 'ตั้งค่าโมเดล AI',
  modelSetupDesc: 'ดาวน์โหลดโมเดล AI ที่จำเป็นเพื่อเปิดใช้งานการรู้จำเสียงและการแปลแบบออฟไลน์',
  progress: 'ความคืบหน้า',
  modelsReady: 'โมเดลพร้อมแล้ว',
  totalSize: 'ประมาณ 400 MB',
  required: 'จำเป็น',
  downloadAll: 'ดาวน์โหลดโมเดลทั้งหมด',
  downloading: 'กำลังดาวน์โหลด...',
  preparing: 'กำลังเตรียม...',
  skipForNow: 'ข้ามก่อน',
  retry: 'ลองใหม่',
  download: 'ดาวน์โหลด',
  allModelsReady: 'โมเดลทั้งหมดพร้อมแล้ว — เริ่มใช้งาน',
  startUsing: 'เริ่มใช้งาน',
  modelsStoredLocally: 'ดาวน์โหลดโมเดลเพียงครั้งเดียวและจัดเก็บในเครื่อง ต้องใช้อินเทอร์เน็ตสำหรับการดาวน์โหลดครั้งแรกเท่านั้น',
  downloadFailed: 'การดาวน์โหลดล้มเหลว',

  asrModelName: 'ASR: SenseVoice (จีน/อังกฤษ)',
  asrModelDesc: 'โมเดลรู้จำเสียงพูด รองรับ จีน/อังกฤษ/ญี่ปุ่น/เกาหลี/กวางตุ้ง',
  ttsZhModelName: 'TTS: VITS (จีน)',
  ttsZhModelDesc: 'การแปลงข้อความเป็นเสียงพูดภาษาจีน มี 5 เสียง',
  ttsEnModelName: 'TTS: Piper (อังกฤษ)',
  ttsEnModelDesc: 'การแปลงข้อความเป็นเสียงพูดภาษาอังกฤษ (เสียง Lessac Medium)',

  listening: 'กำลังฟัง',
  speaking: 'กำลังพูด',

  loading: 'กำลังโหลด...',
  error: 'ข้อผิดพลาด',
  ok: 'ตกลง',
}

export const TRANSLATIONS: Record<UILanguage, TranslationDict> = { zh, en, th }

export const LANGUAGE_LABELS: Record<UILanguage, string> = {
  zh: '中文',
  en: 'English',
  th: 'ภาษาไทย',
}
