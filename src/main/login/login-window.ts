import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { CHANGYAN_LOGIN_URL } from '@shared/constants'
import { logDebug, logError, logInfo, logWarn } from '../services/logger'

export interface ChangyanLoginResult {
  uid: string
  captchaResult: string
}

export interface CapturedPayload {
  url: string
  status: number
  responseBody: string
}

export function parseCapturedPayload(payload: CapturedPayload): ChangyanLoginResult | null {
  if (!payload.url.includes('/login/checkLogin')) {
    logDebug('ChangyanLogin', '忽略非 checkLogin 响应', { url: payload.url })
    return null
  }
  if (payload.status !== 200) {
    logWarn('ChangyanLogin', 'checkLogin 响应状态异常', { status: payload.status })
    return null
  }

  const response = JSON.parse(payload.responseBody) as Record<string, unknown>
  const code = response.Code ?? response.code
  const rawData = response.Data ?? response.data
  if (Number(code) !== 0 || rawData === undefined || rawData === null) {
    logWarn('ChangyanLogin', 'checkLogin 返回不完整', { code, hasData: rawData !== undefined })
    return null
  }

  const data = (
    typeof rawData === 'string'
      ? JSON.parse(rawData)
      : rawData
  ) as {
    uid?: string
    captchaResult?: string
  }
  if (!data.uid || !data.captchaResult) return null
  logInfo('ChangyanLogin', '解析到 uid 和 captchaResult', {
    uid: data.uid,
    captchaLength: data.captchaResult.length
  })
  return {
    uid: data.uid,
    captchaResult: data.captchaResult
  }
}

function captureScript(): string {
  return `
    (() => {
      if (window.__etsDesktopCaptureInstalled) return 'installed';
      window.__etsDesktopCaptureInstalled = true;

      const report = (url, status, body) => {
        try {
          window.etsLoginBridge?.capture({ url: String(url), status: Number(status), responseBody: String(body || '') });
        } catch (error) {
          console.warn('[ETS100] login capture failed', error);
        }
      };

      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        this.__etsUrl = String(url);
        return originalOpen.apply(this, arguments);
      };

      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function() {
        this.addEventListener('loadend', () => {
          if (String(this.__etsUrl || '').includes('/login/checkLogin')) {
            report(this.__etsUrl, this.status, this.responseText);
          }
        });
        return originalSend.apply(this, arguments);
      };

      const originalFetch = window.fetch;
      window.fetch = async function(input, init) {
        const response = await originalFetch.apply(this, arguments);
        const url = typeof input === 'string' ? input : input?.url;
        if (String(url || '').includes('/login/checkLogin')) {
          response.clone().text().then((body) => report(url, response.status, body)).catch(() => {});
        }
        return response;
      };

      return 'installed';
    })();
  `
}

function showLoginStatus(window: BrowserWindow, message: string, error = false): void {
  if (window.isDestroyed()) return
  const color = error ? '#b42318' : '#0f8f7a'
  window.webContents
    .executeJavaScript(
      `(() => {
        const id = '__ets_login_status__';
        let node = document.getElementById(id);
        if (!node) {
          node = document.createElement('div');
          node.id = id;
          Object.assign(node.style, {
            position: 'fixed',
            left: '50%',
            bottom: '20px',
            transform: 'translateX(-50%)',
            zIndex: '2147483647',
            maxWidth: '80vw',
            padding: '10px 14px',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '13px',
            fontFamily: 'Microsoft YaHei UI, sans-serif',
            boxShadow: '0 8px 30px rgba(0,0,0,.22)'
          });
          document.body.appendChild(node);
        }
        node.textContent = ${JSON.stringify(message)};
        node.style.background = ${JSON.stringify(color)};
      })()`
    )
    .catch((error) => logWarn('ChangyanLogin', '无法显示登录状态提示', error))
}

function attachNetworkCapture(
  loginWindow: BrowserWindow,
  onPayload: (payload: CapturedPayload) => void
): void {
  const pending = new Map<string, { url: string; status: number }>()
  try {
    loginWindow.webContents.debugger.attach('1.3')
    loginWindow.webContents.debugger.sendCommand('Network.enable').catch((error) => {
      logError('ChangyanLogin', '启用 CDP Network 失败', error)
    })
    loginWindow.webContents.debugger.on('message', (_event, method, params) => {
      if (method === 'Network.responseReceived') {
        const response = params.response as {
          url?: string
          status?: number
          mimeType?: string
        }
        const url = response.url ?? ''
        logDebug('ChangyanLogin', 'CDP 网络响应', {
          requestId: params.requestId,
          status: response.status,
          mimeType: response.mimeType,
          url
        })
        if (url.includes('/login/checkLogin')) {
          pending.set(params.requestId as string, {
            url,
            status: Number(response.status ?? 0)
          })
        }
      } else if (method === 'Network.loadingFinished') {
        const requestId = params.requestId as string
        const info = pending.get(requestId)
        if (!info) return
        pending.delete(requestId)
        void loginWindow.webContents.debugger
          .sendCommand('Network.getResponseBody', { requestId })
          .then((result) => {
            onPayload({
              url: info.url,
              status: info.status,
              responseBody: String(result.body ?? '')
            })
          })
          .catch((error) => {
            logError('ChangyanLogin', 'CDP 读取 checkLogin 响应体失败', error)
          })
      } else if (method === 'Network.loadingFailed') {
        logWarn('ChangyanLogin', 'CDP 网络请求失败', params)
      }
    })
    loginWindow.webContents.debugger.on('detach', (_event, reason) => {
      logWarn('ChangyanLogin', 'CDP 已断开', { reason })
    })
  } catch (error) {
    logError('ChangyanLogin', '附加 CDP 网络监听失败', error)
  }
}

export async function openChangyanLogin(parent?: BrowserWindow): Promise<ChangyanLoginResult> {
  return new Promise((resolve, reject) => {
    let settled = false
    logInfo('ChangyanLogin', '打开畅言登录窗口')
    const loginWindow = new BrowserWindow({
      width: 1120,
      height: 760,
      minWidth: 860,
      minHeight: 620,
      parent,
      modal: false,
      show: false,
      title: '畅言登录',
      backgroundColor: '#f5f6f4',
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/login.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        partition: 'persist:changyan-login'
      }
    })

    const finish = (result: ChangyanLoginResult) => {
      if (settled) return
      settled = true
      logInfo('ChangyanLogin', '登录信息处理完成，关闭登录窗口')
      ipcMain.removeListener('login:capture', onCapture)
      resolve(result)
      if (!loginWindow.isDestroyed()) loginWindow.close()
    }

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      logError('ChangyanLogin', '登录窗口失败', error)
      ipcMain.removeListener('login:capture', onCapture)
      reject(error)
      if (!loginWindow.isDestroyed()) loginWindow.close()
    }

    const onCapture = (event: Electron.IpcMainEvent, payload: CapturedPayload) => {
      if (event.sender.id !== loginWindow.webContents.id) return
      logDebug('ChangyanLogin', '收到 preload 注入捕获数据', {
        url: payload.url,
        status: payload.status,
        bodyLength: payload.responseBody.length
      })
      try {
        const result = parseCapturedPayload(payload)
        if (result) {
          showLoginStatus(loginWindow, '登录成功，正在换取 ETS Token...')
          finish(result)
        }
      } catch (error) {
        logError('ChangyanLogin', 'Failed to parse captured payload', error)
      }
    }

    ipcMain.on('login:capture', onCapture)
    loginWindow.once('ready-to-show', () => loginWindow.show())
    loginWindow.webContents.on('did-start-loading', () => {
      logDebug('ChangyanLogin', '页面开始加载')
    })
    loginWindow.webContents.on('did-finish-load', () => {
      logInfo('ChangyanLogin', '页面加载完成', {
        url: loginWindow.webContents.getURL()
      })
      loginWindow.webContents.executeJavaScript(captureScript()).catch((error) => {
        logError('ChangyanLogin', 'Failed to inject capture script', error)
      })
    })
    loginWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
      logError('ChangyanLogin', '页面加载失败', { code, description, url })
      showLoginStatus(loginWindow, `页面加载失败：${description || code}`, true)
    })
    loginWindow.webContents.on('did-navigate', (_event, url) => {
      logInfo('ChangyanLogin', '页面导航', { url })
    })
    loginWindow.webContents.on('did-navigate-in-page', (_event, url) => {
      logDebug('ChangyanLogin', '页面单页导航', { url })
    })
    loginWindow.webContents.on('render-process-gone', (_event, details) => {
      logError('ChangyanLogin', '登录页渲染进程退出', details)
    })
    loginWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      logDebug('ChangyanLoginPage', message, { level, line, sourceId })
    })
    loginWindow.on('closed', () => {
      ipcMain.removeListener('login:capture', onCapture)
      logInfo('ChangyanLogin', '登录窗口已关闭')
      if (!settled) reject(new Error('登录窗口已关闭'))
    })

    attachNetworkCapture(loginWindow, (payload) => {
      logDebug('ChangyanLogin', 'CDP 捕获 checkLogin 响应', {
        url: payload.url,
        status: payload.status,
        bodyLength: payload.responseBody.length
      })
      try {
        const result = parseCapturedPayload(payload)
        if (result) {
          showLoginStatus(loginWindow, '登录成功，正在换取 ETS Token...')
          finish(result)
        }
      } catch (error) {
        logError('ChangyanLogin', '解析 CDP checkLogin 响应失败', error)
      }
    })

    setTimeout(() => {
      if (!settled) {
        logWarn('ChangyanLogin', '登录等待超过 30 秒')
        showLoginStatus(
          loginWindow,
          '已等待 30 秒，尚未检测到登录结果。请查看 Debug.txt 日志。',
          true
        )
      }
    }, 30_000)

    loginWindow.loadURL(CHANGYAN_LOGIN_URL).catch(fail)
  })
}

