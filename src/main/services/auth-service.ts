import { randomId, md5, randomHex } from './crypto'
import type { AccountSession, ImportTokenRequest } from '@shared/types'
import { decodeJwt, tokenExpiry } from './jwt'
import { openChangyanLogin } from '../login/login-window'
import { DeviceBindRequiredError, EtsApiClient } from './ets-api'
import { SessionStore } from './session-store'
import { logDebug, logError, logInfo } from './logger'

export class AuthService {
  private readonly store = new SessionStore()

  constructor(private readonly api: EtsApiClient) {}

  getSession(): AccountSession | null {
    return this.store.read()
  }

  async loginPassword(request: {
    phone: string
    password: string
    rememberPassword: boolean
  }): Promise<AccountSession> {
    const phone = request.phone.trim()
    if (!phone || !request.password) {
      throw new Error('请输入手机号和密码')
    }
    logInfo('Auth', '开始账号密码登录', { phone })
    const deviceCode = this.getOrCreateDeviceCode()
    let loginResult: { token: string; raw: Record<string, unknown> }
    try {
      loginResult = await this.api.login(phone, request.password, deviceCode)
    } catch (error) {
      if (error instanceof DeviceBindRequiredError) {
        logInfo('Auth', '登录要求绑定当前设备')
        loginResult = await this.api.bindDevice(
          error.phone,
          error.password,
          error.deviceCode
        )
      } else {
        throw error
      }
    }

    const jwt = decodeJwt(loginResult.token)
    const accounts = await this.api.getEcardList(loginResult.token, 'grlx-native')
    const selected = selectValidAccount(accounts)
    const now = Date.now()
    const previous = this.store.read()
    const session: AccountSession = {
      id: previous?.id ?? randomId(),
      protocolMode: 'grlx-native',
      loginSource: 'password',
      token: loginResult.token,
      userId: String(jwt.payload.id ?? ''),
      login: String(jwt.payload.login ?? phone),
      phone,
      parentAccountId: selected?.parentId,
      recentAccountId: selected?.id,
      displayName: selected?.name || selected?.grade || 'ETS100 账号',
      gradeName: selected?.grade || '',
      classId: selected?.classId,
      tokenCreatedAt: Number(jwt.payload.create ?? Math.floor(Date.now() / 1000)),
      tokenExpiresAt: tokenExpiry(loginResult.token),
      deviceCode,
      storedPassword: request.rememberPassword ? request.password : undefined,
      rememberPassword: request.rememberPassword,
      createdAt: now,
      updatedAt: now
    }
    this.store.write(session)
    logInfo('Auth', '账号密码登录成功', {
      userId: session.userId,
      parentAccountId: session.parentAccountId,
      rememberPassword: request.rememberPassword
    })
    return session
  }

  async reauthenticate(): Promise<AccountSession> {
    const session = this.store.read()
    if (!session?.phone || !session.storedPassword) {
      throw new Error('Token 已失效，且未保存密码，请重新登录')
    }
    return this.loginPassword({
      phone: session.phone,
      password: session.storedPassword,
      rememberPassword: true
    })
  }

  async startWebLogin(): Promise<AccountSession> {
    logInfo('Auth', '开始畅言网页登录')
    const captured = await openChangyanLogin()
    logInfo('Auth', '已取得 checkLogin 数据，准备换取 ETS Token', {
      uid: captured.uid
    })
    const deviceCode = this.getOrCreateDeviceCode()
    const loginResult = await this.api.loginZt(
      captured.uid,
      captured.uid,
      captured.captchaResult,
      deviceCode
    )
    const jwt = decodeJwt(loginResult.token)
    logInfo('Auth', '已取得旧版 ETS Token', {
      userId: jwt.payload.id,
      expiresAt: tokenExpiry(loginResult.token)
    })
    const accounts = await this.api.getEcardList(loginResult.token, 'grlx-native')
    const selected = selectValidAccount(accounts)
    const now = Date.now()
    const session: AccountSession = {
      id: randomId(),
      protocolMode: 'grlx-native',
      loginSource: 'changyan-web',
      token: loginResult.token,
      userId: String(jwt.payload.id ?? ''),
      login: String(jwt.payload.login ?? captured.uid),
      phone: String(loginResult.raw.raw_phone ?? ''),
      parentAccountId: selected?.parentId,
      recentAccountId: loginResult.recentAccountId,
      displayName: selected?.name || selected?.grade || 'ETS100 账号',
      gradeName: String(loginResult.raw.grade_name ?? selected?.grade ?? ''),
      schoolYearId: String(loginResult.raw.school_year_id ?? ''),
      classId: selected?.classId,
      tokenCreatedAt: Number(jwt.payload.create ?? Math.floor(Date.now() / 1000)),
      tokenExpiresAt: tokenExpiry(loginResult.token) ?? Number(loginResult.raw.expire ?? 0),
      deviceCode,
      storedPassword: undefined,
      rememberPassword: false,
      createdAt: now,
      updatedAt: now
    }
    this.store.write(session)
    logInfo('Auth', '会话已加密保存', {
      userId: session.userId,
      parentAccountId: session.parentAccountId
    })
    return session
  }

  importToken(request: ImportTokenRequest): AccountSession {
    const token = request.token.trim().replace(/^Bearer\s+/i, '')
    const jwt = decodeJwt(token)
    const now = Date.now()
    const session: AccountSession = {
      id: randomId(),
      protocolMode: 'grlx-imported-token',
      loginSource: 'imported-token',
      token,
      userId: String(jwt.payload.id ?? ''),
      login: String(jwt.payload.login ?? ''),
      phone: String(jwt.payload.login ?? ''),
      tokenCreatedAt: Number(jwt.payload.create ?? 0) || undefined,
      tokenExpiresAt: tokenExpiry(token),
      deviceCode: this.getOrCreateDeviceCode(),
      storedPassword: undefined,
      rememberPassword: false,
      createdAt: now,
      updatedAt: now
    }
    this.store.write(session)
    logInfo('Auth', '已导入旧版 ETS Token', {
      userId: session.userId,
      expiresAt: session.tokenExpiresAt
    })
    return session
  }

  updateSession(patch: Partial<AccountSession>): AccountSession {
    const current = this.store.read()
    if (!current) throw new Error('尚未登录')
    const next = {
      ...current,
      ...patch,
      updatedAt: Date.now()
    }
    this.store.write(next)
    return next
  }

  logout(): void {
    logInfo('Auth', '清除当前登录会话')
    this.store.clear()
  }

  private getOrCreateDeviceCode(): string {
    const existing = this.store.readDeviceCode()
    if (existing) return existing
    const dataMd5 = md5(randomHex(16)).slice(8, 24).toUpperCase()
    const macMd5 = md5(randomHex(16)).slice(8, 24).toUpperCase()
    const deviceCode = `${dataMd5}|${macMd5}`
    this.store.writeDeviceCode(deviceCode)
    return deviceCode
  }
}

export function selectValidAccount<T extends {
  status: string
  outOfDate: string
  classId: string
  mobileStatus: string
}>(accounts: T[]): T | undefined {
  return (
    accounts.find(
      (account) =>
        account.status === '0' &&
        account.outOfDate === '0' &&
        account.classId.trim() !== '' &&
        account.mobileStatus === '1'
    ) ?? accounts[0]
  )
}
