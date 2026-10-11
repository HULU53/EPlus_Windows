import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'
import { dirname } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { IncomingMessage } from 'node:http'
import {
  API_BASE_URL,
  ETS_CAPTURED_APP_VERSION,
  ETS_CAPTURED_SYSTEM,
  ETS_DEFAULT_DEVICE_NAME,
  ETS_DEFAULT_GLOBAL_CLIENT_VERSION,
  ETS_DEFAULT_LOCAL_IP,
  ETS_DEFAULT_REBIND_DEVICE_NAME,
  ETS_DEFAULT_REBIND_VERSION,
  ETS_DEFAULT_SN,
  ETS_DEFAULT_SYSTEM,
  ETS_DEFAULT_VERSION
} from '@shared/constants'
import type {
  EcardAccount,
  HomeworkInfo,
  HomeworkListResult,
  HomeworkStatus,
  OssUploadConfig,
  ProtocolMode,
  UploadContext
} from '@shared/types'
import { buildEtsEnvelope, parseEtsResponse, assertEtsSuccess } from './ets-envelope'
import { createRequestSn } from './crypto'
import { logDebug, logError, logInfo } from './logger'
import { formatLocalDateTime } from './score-parser'

interface EtsResponse<T = Record<string, unknown>> {
  code?: number | string
  msg?: string
  body?: T
}

export class DeviceBindRequiredError extends Error {
  constructor(
    readonly phone: string,
    readonly password: string,
    readonly deviceCode: string
  ) {
    super('设备需要绑定验证')
    this.name = 'DeviceBindRequiredError'
  }
}

function capturedCommonParams(
  token: string,
  sn = createRequestSn()
): Record<string, unknown> {
  return {
    sn,
    token,
    system: ETS_CAPTURED_SYSTEM,
    is_zk_pad: 0,
    global_client_version: ETS_CAPTURED_APP_VERSION,
    use_https: 1,
    use_homework_privilege: 1,
    ets_app: 0,
    sign_response: 2
  }
}

function legacyCommonParams(token: string): Record<string, unknown> {
  return {
    sn: ETS_DEFAULT_SN,
    token,
    version: ETS_DEFAULT_VERSION,
    system: ETS_DEFAULT_SYSTEM,
    global_client_version: ETS_DEFAULT_GLOBAL_CLIENT_VERSION,
    sign_response: 1
  }
}

function commonParamsByMode(
  token: string,
  mode: ProtocolMode,
  sn = createRequestSn()
): Record<string, unknown> {
  return mode === 'grlx-imported-token'
    ? capturedCommonParams(token, sn)
    : legacyCommonParams(token)
}

export class EtsApiClient {
  async request<T extends Record<string, unknown>>(
    route: string,
    params: Record<string, unknown>,
    options: { allowCodes?: number[] } = {}
  ): Promise<EtsResponse<T>> {
    const envelope = buildEtsEnvelope(route, params)
    logInfo('ETS', `POST /${route}`)
    logDebug('ETS', '请求参数', params)
    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}/${route}`, {
        method: 'POST',
        headers: {
          Host: 'api.ets100.com',
          'User-Agent': 'libcurl-agent/1.0',
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: '*/*'
        },
        body: JSON.stringify(envelope)
      })
    } catch (error) {
      logError('ETS', `网络请求失败 /${route}`, error)
      throw error
    }

    if (!response.ok) {
      const body = await response.text()
      logError('ETS', `HTTP ${response.status} /${route}`, body)
      throw new Error(`HTTP ${response.status}: ${body}`)
    }
    const json = await response.json()
    logDebug('ETS', `响应 /${route}`, json)
    const parsed = parseEtsResponse<EtsResponse<T>>(json)
    if (!options.allowCodes?.includes(Number(parsed.code))) {
      assertEtsSuccess(parsed)
    }
    return parsed
  }

  async login(
    phone: string,
    password: string,
    deviceCode: string
  ): Promise<{ token: string; raw: Record<string, unknown> }> {
    logInfo('ETS', '账号密码登录')
    const response = await this.request(
      'user/login',
      {
        sn: ETS_DEFAULT_SN,
        phone,
        password,
        device_code: deviceCode,
        device_name: ETS_DEFAULT_DEVICE_NAME,
        version: ETS_DEFAULT_VERSION,
        local_ip: ETS_DEFAULT_LOCAL_IP,
        system: ETS_DEFAULT_SYSTEM,
        global_client_version: ETS_DEFAULT_GLOBAL_CLIENT_VERSION,
        sign_response: 1
      },
      { allowCodes: [30014] }
    )
    if (Number(response.code) === 30014) {
      throw new DeviceBindRequiredError(phone, password, deviceCode)
    }
    const body = response.body ?? {}
    const token = typeof body.token === 'string' ? body.token : ''
    if (!token) throw new Error('登录成功但未返回 token')
    return { token, raw: body }
  }

  async bindDevice(
    phone: string,
    password: string,
    deviceCode: string
  ): Promise<{ token: string; raw: Record<string, unknown> }> {
    logInfo('ETS', '设备需要绑定，调用 rebind-code')
    const response = await this.request('user/rebind-code', {
      sn: ETS_DEFAULT_SN,
      phone,
      email: '',
      password,
      code: '0',
      version: ETS_DEFAULT_REBIND_VERSION,
      device_name: ETS_DEFAULT_REBIND_DEVICE_NAME,
      device_code: deviceCode,
      local_ip: ETS_DEFAULT_LOCAL_IP,
      system: ETS_DEFAULT_SYSTEM,
      global_client_version: ETS_DEFAULT_GLOBAL_CLIENT_VERSION,
      sign_response: 1
    })
    const body = response.body ?? {}
    const token = typeof body.token === 'string' ? body.token : ''
    if (!token) throw new Error('设备绑定成功但未返回 token')
    return { token, raw: body }
  }

  async loginZt(
    login: string,
    userId: string,
    sucUserToken: string,
    deviceCode: string
  ): Promise<{ token: string; recentAccountId?: string; raw: Record<string, unknown> }> {
    const response = await this.request('user/login-zt', {
      sn: ETS_DEFAULT_SN,
      login,
      user_id: userId,
      device_name: 'Android',
      device_code: deviceCode,
      suc_user_token: sucUserToken,
      suc_device_name: 'Other',
      os_type: 'android',
      system: ETS_DEFAULT_SYSTEM,
      global_client_version: '',
      sign_response: 1
    })
    const body = response.body ?? {}
    const token = typeof body.token === 'string' ? body.token : ''
    if (!token) throw new Error('讯飞登录成功但未返回 token')
    return {
      token,
      recentAccountId:
        typeof body.recent_account_id === 'string' ? body.recent_account_id : undefined,
      raw: body
    }
  }

  async getEcardList(
    token: string,
    mode: ProtocolMode = 'grlx-native'
  ): Promise<EcardAccount[]> {
    const sn = createRequestSn()
    const response = await this.request<Record<string, Record<string, unknown>>>(
      'm/ecard/list',
      {
        ...commonParamsByMode(token, mode, sn),
        version: ETS_DEFAULT_VERSION
      }
    )
    const body = response.body ?? {}
    return Object.entries(body).map(([key, value]) => {
      const account = value ?? {}
      return {
        key,
        id: String(account.id ?? ''),
        parentId: String(account.parent_id ?? ''),
        userAccountId: String(account.user_account_id ?? ''),
        name: String(account.name ?? ''),
        grade: String(account.grade ?? ''),
        className: String(account.class_name ?? ''),
        classId: String(account.class_id ?? ''),
        status: String(account.status ?? ''),
        outOfDate: String(account.out_of_date ?? ''),
        mobileStatus: String(account.mobile_status ?? ''),
        raw: account
      }
    })
  }

  async getHomeworkList(
    token: string,
    parentAccountId: string,
    status: HomeworkStatus,
    mode: ProtocolMode = 'grlx-native'
  ): Promise<HomeworkListResult> {
    const sn = createRequestSn()
    const common = commonParamsByMode(token, mode, sn)
    const captured = mode === 'grlx-imported-token'
    const response = await this.request<Record<string, unknown>>('g/homework/list', {
      ...common,
      parent_account_id: parentAccountId,
      status,
      limit: 0,
      offset: 0,
      ...(captured ? { show_offline: 1, only_parent: 1, get_audio_task: 1 } : {}),
      show_old_homework: 1,
      get_to_do_count: 1,
      get_to_overtime_count: 1,
      check_pass: 1,
      ...(captured ? { version: 10 } : {})
    })
    const body = response.body ?? {}
    const rawData = Array.isArray(body.data) ? body.data : []
    const homeworks: HomeworkInfo[] = rawData.map((item) => {
      const row = item as Record<string, unknown>
      const struct = (row.struct ?? {}) as Record<string, unknown>
      const contents = Array.isArray(struct.contents) ? struct.contents : []
      return {
        id: String(row.id ?? ''),
        name: String(row.name ?? '未命名作业'),
        status,
        contents: contents.map((content) => {
          const entry = content as Record<string, unknown>
          return {
            groupName: String(entry.group_name ?? entry.groupName ?? ''),
            url: String(entry.url ?? '')
          }
        }),
        raw: row
      }
    })

    return {
      baseUrl: String(body.base_url ?? ''),
      status,
      homeworks,
      totalCount: Number(body.all_count ?? homeworks.length),
      todoCount: Number(body.to_do_count ?? 0),
      overtimeCount: Number(body.to_over_time_count ?? body.to_overtime_count ?? 0)
    }
  }

  async getOssUploadConfig(token: string): Promise<OssUploadConfig> {
    const sn = createRequestSn()
    const response = await this.request<Record<string, unknown>>(
      'p1/student/config/config/ossEvaluateUploadStsToken',
      {
        system: '2',
        is_zk_pad: 0,
        global_client_version: ETS_CAPTURED_APP_VERSION,
        sn,
        token,
        use_https: 1,
        use_homework_privilege: 1,
        ets_app: 0,
        sign_response: 2
      }
    )
    const body = response.body ?? {}
    const upload = (body.upload ?? {}) as Record<string, unknown>
    const config: OssUploadConfig = {
      securityToken: String(upload.securityToken ?? ''),
      accessKeyId: String(upload.accessKeyId ?? ''),
      accessKeySecret: String(upload.accessKeySecret ?? ''),
      bucket: String(upload.bucket ?? ''),
      endpoint: String(upload.endpoint ?? ''),
      prefix: String(upload.prefix ?? 'https://'),
      cname: String(upload.cname ?? ''),
      expiration: String(upload.expiration ?? ''),
      region: String(upload.region ?? ''),
      mp3Path: String(body.mp3Path ?? ''),
      spxPath: String(body.spxPath ?? ''),
      xmlPath: String(body.xmlPath ?? ''),
      timeout: Number(body.timeout ?? 0)
    }
    if (!config.accessKeyId || !config.accessKeySecret || !config.securityToken) {
      throw new Error('OSS STS 响应不完整')
    }
    return config
  }

  async submitAudioSync(params: {
    token: string
    context: UploadContext
    score: string
    scoreDetail: string
    mp3Url: string
    speexUrl: string
    xmlUrl: string
  }): Promise<Record<string, unknown>> {
    const sn = createRequestSn()
    const response = await this.request<Record<string, unknown>>(
      `m/audio/sync-v2?sn=${encodeURIComponent(sn)}`,
      {
        homework_id: params.context.homeworkId,
        use_time: params.context.useTime ?? 0,
        resource_id: params.context.resourceId,
        serial_id: params.context.serialId ?? '0',
        set_id: params.context.setId,
        entity_id: params.context.entityId,
        order: params.context.order,
        score: params.score,
        correct: params.context.correct ?? 0,
        auto_submit: 1,
        client_time: formatLocalDateTime(),
        version: 2,
        graduation: 0,
        upload_file_id: '',
        upload_file_url: params.mp3Url,
        detail_file_id: '',
        detail_file_url: params.xmlUrl,
        score_detail: params.scoreDetail,
        mark_service: 1,
        spx_file_url: params.speexUrl,
        mark_trace_id: params.context.markTraceId || JSON.stringify({ engine: '' }),
        use_https: 1,
        use_homework_privilege: 1,
        system: '2',
        global_client_version: ETS_CAPTURED_APP_VERSION,
        sn,
        sign_response: 2,
        token: params.token,
        ets_app: 0,
        is_zk_pad: 0
      }
    )
    return response.body ?? {}
  }

  async submitChoiceSync(params: {
    token: string
    context: UploadContext
    score: string
    scoreDetail: string
    choose: string
  }): Promise<Record<string, unknown>> {
    const sn = createRequestSn()
    const response = await this.request<Record<string, unknown>>(
      `m/audio/sync-v2?sn=${encodeURIComponent(sn)}`,
      {
        homework_id: params.context.homeworkId,
        use_time: params.context.useTime ?? 0,
        resource_id: params.context.resourceId,
        serial_id: params.context.serialId ?? '0',
        set_id: params.context.setId,
        entity_id: params.context.entityId,
        order: params.context.order,
        score: params.score,
        correct: 0,
        auto_submit: 1,
        client_time: formatLocalDateTime(),
        version: 2,
        graduation: 0,
        upload_file_id: '0',
        upload_file_url: '',
        detail_file_id: '',
        detail_file_url: '',
        score_detail: params.scoreDetail,
        mark_service: 1,
        spx_file_url: '',
        mark_trace_id: '',
        use_https: 1,
        use_homework_privilege: 1,
        system: '2',
        global_client_version: ETS_CAPTURED_APP_VERSION,
        sn,
        sign_response: 2,
        token: params.token,
        ets_app: 0,
        is_zk_pad: 0
      }
    )
    return response.body ?? {}
  }

  async downloadFile(
    url: string,
    destination: string,
    onProgress?: (downloaded: number, total: number) => void
  ): Promise<void> {
    logInfo('Download', '开始下载', { url, destination })
    const response = await this.openDownloadStream(url)
    const total = Number(response.headers['content-length'] ?? 0)
    let downloaded = 0
    const counter = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        downloaded += chunk.length
        onProgress?.(downloaded, total)
        callback(null, chunk)
      }
    })

    await mkdir(dirname(destination), { recursive: true })
    await pipeline(response, counter, createWriteStream(destination))
    if (downloaded === 0) {
      throw new Error(`下载完成但未收到数据：${url}`)
    }
    logInfo('Download', '下载完成', {
      url,
      destination,
      bytes: downloaded,
      total
    })
  }

  private openDownloadStream(url: string, redirectCount = 0): Promise<IncomingMessage> {
    if (redirectCount > 5) {
      return Promise.reject(new Error(`下载重定向次数过多：${url}`))
    }
    return new Promise((resolve, reject) => {
      const target = new URL(url)
      const isCdn = /(^|\.)(cdn\.subject|cdnsubject|cdnfei|cdnfeis|ets60)\.ets100\.com$/i.test(
        target.hostname
      )
      const request = (target.protocol === 'http:' ? httpGet : httpsGet)(
        target,
        {
          headers: {
            Accept: '*/*',
            'User-Agent': 'libcurl-agent/1.0'
          },
          rejectUnauthorized: target.protocol === 'https:' ? !isCdn : undefined
        },
        (response) => {
          const status = response.statusCode ?? 0
          const location = response.headers.location
          if (status >= 300 && status < 400 && location) {
            response.resume()
            const next = new URL(location, target).toString()
            logInfo('Download', '跟随重定向', { from: url, to: next, status })
            this.openDownloadStream(next, redirectCount + 1).then(resolve, reject)
            return
          }
          if (status !== 200) {
            response.resume()
            reject(new Error(`下载失败 HTTP ${status}: ${url}`))
            return
          }
          resolve(response)
        }
      )
      request.on('error', (error) => {
        logError('Download', '下载请求异常', {
          url,
          host: target.hostname,
          isCdn,
          error
        })
        reject(error)
      })
    })
  }
}
