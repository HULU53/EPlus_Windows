export type ProtocolMode = 'grlx-native' | 'grlx-imported-token'
export type LoginSource = 'password' | 'changyan-web' | 'imported-token'
export type HomeworkStatus = '1' | '2' | '3'
export type AttachmentKind = 'audio' | 'speex' | 'xml'
export type TaskKind =
  | 'auth'
  | 'homework-list'
  | 'paper-download'
  | 'audio-transcode'
  | 'oss-upload'
  | 'sync-submit'
export type TaskStatus =
  | 'queued'
  | 'running'
  | 'waiting-auth'
  | 'waiting-confirmation'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
export type LogLevel = 'error' | 'info' | 'debug'

export interface AccountSession {
  id: string
  protocolMode: ProtocolMode
  loginSource: LoginSource
  token: string
  userId?: string
  login?: string
  phone?: string
  parentAccountId?: string
  recentAccountId?: string
  displayName?: string
  gradeName?: string
  schoolYearId?: string
  classId?: string
  tokenCreatedAt?: number
  tokenExpiresAt?: number
  deviceCode: string
  storedPassword?: string
  rememberPassword?: boolean
  createdAt: number
  updatedAt: number
}

export interface EcardAccount {
  key: string
  id: string
  parentId: string
  userAccountId: string
  name: string
  grade: string
  className: string
  classId: string
  status: string
  outOfDate: string
  mobileStatus: string
  raw: Record<string, unknown>
}

export interface HomeworkContent {
  groupName: string
  url: string
}

export interface HomeworkInfo {
  id: string
  name: string
  status: HomeworkStatus
  contents: HomeworkContent[]
  raw: Record<string, unknown>
}

export interface HomeworkListResult {
  baseUrl: string
  status: HomeworkStatus
  homeworks: HomeworkInfo[]
  totalCount?: number
  todoCount?: number
  overtimeCount?: number
}

export interface QuestionAttachment {
  id: string
  kind: AttachmentKind
  fileName: string
  mimeType: string
  size: number
  localPath: string
  createdAt: number
  source: 'file' | 'recording' | 'generated'
}

export interface ScoreData {
  totalScore: string
  choose: string
  fluencyScore: string
  accuracyScore: string
  integrityScore: string
  standardScore: string
  category: string
  repeatMode: string
  version: string
  rateScale: number
  source: 'xml' | 'manual' | 'default'
  allowOverflow?: boolean
}

export interface UploadContext {
  homeworkId: string
  resourceId: string
  setId: string
  entityId: string
  order: string
  serialId?: string
  useTime?: number
  score?: string
  correct?: number
  markTraceId?: string
}

export interface Question {
  id: string
  homeworkId: string
  contentUrl: string
  order: number
  sectionOrder: number
  sectionCaption: string
  typeName: string
  structureType: string
  questionText: string
  answers: string[]
  options?: QuestionOption[]
  correctAnswer?: string
  selectedAnswer?: string
  originalText?: string
  category?: string
  partName?: string
  maxScore?: number
  attachments: QuestionAttachment[]
  scoreOverride?: ScoreData
  uploadContext?: UploadContext
  uploadState?: QuestionUploadState
}

export interface QuestionOption {
  label: string
  text: string
}

export interface QuestionUploadState {
  status: 'idle' | 'ready' | 'uploading' | 'uploaded' | 'submitted' | 'failed'
  taskId?: string
  message?: string
  mp3Url?: string
  speexUrl?: string
  xmlUrl?: string
  updatedAt?: number
}

export interface PaperSection {
  caption: string
  typeName: string
  structureType: string
  questions: Question[]
  originalContent?: string
}

export interface Paper {
  id: string
  homeworkId: string
  homeworkName: string
  title: string
  baseUrl: string
  setId?: string
  resourceId?: string
  parserVersion?: number
  sections: PaperSection[]
  createdAt: number
}

export interface TaskLog {
  at: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  details?: string
}

export interface TaskJob {
  id: string
  kind: TaskKind
  title: string
  status: TaskStatus
  progress: number
  message: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
  retryable: boolean
  payload?: Record<string, unknown>
  logs: TaskLog[]
}

export interface AppSettings {
  settingsVersion?: number
  theme: 'system' | 'light' | 'dark'
  dryRun: boolean
  ffmpegPath: string
  maxDownloads: number
  keepOssObjectsInDryRun: boolean
  logRetentionDays: number
  loggingEnabled: boolean
  logLevel: LogLevel
  experimentalCustomScoreEnabled: boolean
}

export interface OssUploadConfig {
  securityToken: string
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  endpoint: string
  prefix: string
  cname: string
  expiration: string
  region: string
  mp3Path: string
  spxPath: string
  xmlPath: string
  timeout: number
}

export interface UploadRequest {
  paperId: string
  questionId: string
  confirmRealSubmit: boolean
}

export interface AttachmentRequest {
  paperId: string
  questionId: string
  kind: AttachmentKind
  fileName: string
  mimeType: string
  bytes: Uint8Array
}

export interface GeneratedXmlResult {
  attachment: QuestionAttachment
  score: ScoreData
  uploadContext: UploadContext
}

export interface ApplyTemplateResult {
  paper: Paper
  templated: number
  skipped: number
  choiceAnswered?: number
}

export interface CustomScoreTemplateResult extends ApplyTemplateResult {
  listeningAnswerExternal: number
  retellExternal: number
  readingExternal: number
}

export interface SubmitAllResult {
  paper: Paper
  submitted: number
  skipped: number
  failed: string[]
}

export interface RankingEntry {
  rank?: number
  name: string
  score: number
  accountId?: number
  userId?: number
  finishTime?: string
}

export interface ImportTokenRequest {
  token: string
}

export interface PasswordLoginRequest {
  phone: string
  password: string
  rememberPassword: boolean
}

export interface SettingsUpdate {
  patch: Partial<AppSettings>
}

export interface TaskEvent {
  type: 'created' | 'updated' | 'removed'
  task?: TaskJob
  taskId?: string
}

export interface EtsApiBridge {
  auth: {
    startWebLogin(): Promise<AccountSession>
    loginPassword(request: PasswordLoginRequest): Promise<AccountSession>
    importToken(request: ImportTokenRequest): Promise<AccountSession>
    getStatus(): Promise<AccountSession | null>
    logout(): Promise<void>
  }
  homework: {
    list(status: HomeworkStatus): Promise<HomeworkListResult>
    open(homework: HomeworkInfo, baseUrl: string): Promise<Paper>
    refresh(status: HomeworkStatus): Promise<HomeworkListResult>
  }
  paper: {
    attachFile(request: AttachmentRequest): Promise<QuestionAttachment>
    attachRecording(request: AttachmentRequest): Promise<QuestionAttachment>
    removeAttachment(paperId: string, questionId: string, attachmentId: string): Promise<void>
    setScoreOverride(paperId: string, questionId: string, score?: ScoreData): Promise<void>
    setUploadContext(paperId: string, questionId: string, context: UploadContext): Promise<void>
    setChoiceAnswer(paperId: string, questionId: string, answer: string): Promise<void>
    generateFullScoreXml(paperId: string, questionId: string): Promise<GeneratedXmlResult>
    applyFullScoreTemplate(paperId: string): Promise<ApplyTemplateResult>
    applyCustomScoreTemplate(
      paperId: string,
      totalScore: number
    ): Promise<CustomScoreTemplateResult>
    submitAll(paperId: string, confirmRealSubmit: boolean): Promise<SubmitAllResult>
  }
  upload: {
    validate(request: UploadRequest): Promise<{ ok: boolean; errors: string[] }>
    submit(request: UploadRequest): Promise<TaskJob>
    retry(taskId: string): Promise<TaskJob>
  }
  tasks: {
    list(): Promise<TaskJob[]>
    cancel(taskId: string): Promise<void>
    onEvent(callback: (event: TaskEvent) => void): () => void
  }
  settings: {
    get(): Promise<AppSettings>
    update(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  ranking: {
    get(homeworkId: string): Promise<RankingEntry[]>
  }
  diagnostics: {
    export(): Promise<string>
    logPath(): Promise<string>
  }
  system: {
    pickFfmpeg(): Promise<string | null>
    openPath(path: string): Promise<void>
  }
}
