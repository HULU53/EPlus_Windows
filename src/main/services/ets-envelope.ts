import {
  ETS_PID,
  ETS_SECRET_KEY
} from '@shared/constants'
import { base64, md5 } from './crypto'

export interface EtsEnvelopeRequest {
  body: string
  head: {
    version: '1.0'
    sign: string
    pid: string
    time: number
  }
}

export function buildEtsEnvelope(
  route: string,
  params: Record<string, unknown>,
  nowSeconds = Math.floor(Date.now() / 1000)
): EtsEnvelopeRequest {
  const bodyJson = JSON.stringify([{ r: route, params }])
  const body = base64(bodyJson)
  const sign = md5(`${ETS_PID}${nowSeconds}${body}${ETS_SECRET_KEY}`)

  return {
    body,
    head: {
      version: '1.0',
      sign,
      pid: ETS_PID,
      time: nowSeconds
    }
  }
}

export function parseEtsResponse<T = Record<string, unknown>>(value: unknown): T {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new Error('ETS 接口返回空数组')
    }
    return value[0] as T
  }
  if (value && typeof value === 'object') {
    return value as T
  }
  throw new Error('ETS 接口返回格式不正确')
}

export function assertEtsSuccess(value: {
  code?: unknown
  msg?: unknown
}): void {
  const code = value.code
  if (code === undefined || code === null || code === '' || Number(code) === 0) {
    return
  }
  const message = typeof value.msg === 'string' && value.msg.trim()
    ? value.msg
    : `业务错误 code=${String(code)}`
  throw Object.assign(new Error(message), { code })
}

