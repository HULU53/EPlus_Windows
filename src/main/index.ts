import { app, BrowserWindow, shell } from 'electron'
import { cpSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpc, type IpcContext } from './ipc'
import { AudioService } from './services/audio-service'
import { AuthService } from './services/auth-service'
import { AttachmentService } from './services/attachment-service'
import { EtsApiClient } from './services/ets-api'
import { OssService } from './services/oss-service'
import { PaperService } from './services/paper-service'
import { SettingsService } from './services/settings-service'
import { TaskManager } from './services/task-manager'
import { UploadService } from './services/upload-service'
import { configureLogger, logError, logInfo } from './services/logger'

let mainWindow: BrowserWindow | null = null
const APP_NAME = 'E+Desk'

app.setName(APP_NAME)

function migrateOldUserData(): void {
  try {
    const oldUserData = join(app.getPath('appData'), 'ets100-desktop')
    const currentUserData = app.getPath('userData')
    if (existsSync(oldUserData) && !existsSync(currentUserData)) {
      cpSync(oldUserData, currentUserData, { recursive: true })
      console.info(`[Migration] Copied user data to ${currentUserData}`)
    }
  } catch (error) {
    console.warn('[Migration] Failed to migrate old user data', error)
  }
}

function createMainWindow(): BrowserWindow {
  logInfo('App', '创建主窗口')
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'E+Desk',
    backgroundColor: '#f4f5f3',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.once('ready-to-show', () => window.show())
  window.webContents.on('did-finish-load', () => {
    logInfo('App', '主窗口页面加载完成')
  })
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    logError('App', '主窗口页面加载失败', { code, description, url })
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  if (process.env.ETS100_SCREENSHOT_PATH) {
    window.webContents.once('did-finish-load', async () => {
      setTimeout(async () => {
        try {
          const image = await window.capturePage()
          writeFileSync(process.env.ETS100_SCREENSHOT_PATH!, image.toPNG())
        } finally {
          app.quit()
        }
      }, 1200)
    })
  }

  return window
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.hulu.eplusdesk')
  migrateOldUserData()

  const api = new EtsApiClient()
  const settings = new SettingsService()
  const initialSettings = settings.get()
  configureLogger({
    enabled: initialSettings.loggingEnabled,
    level: initialSettings.logLevel
  })
  logInfo('App', '应用启动', {
    version: app.getVersion(),
    platform: process.platform,
    userData: app.getPath('userData')
  })
  const tasks = new TaskManager()
  const auth = new AuthService(api)
  const attachments = new AttachmentService()
  const papers = new PaperService(api, tasks)
  const audio = new AudioService()
  const oss = new OssService()
  const uploads = new UploadService(api, papers, audio, oss, tasks)

  const context: IpcContext = {
    api,
    auth,
    attachments,
    audio,
    papers,
    settings,
    tasks,
    uploads
  }
  registerIpc(context)

  mainWindow = createMainWindow()
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

process.on('uncaughtException', (error) => {
  logError('Process', '未捕获异常', error)
})

process.on('unhandledRejection', (reason) => {
  logError('Process', '未处理的 Promise 拒绝', reason)
})
