export interface JwtPayload {
  aid?: string
  exp?: number | string
  create?: number | string
  id?: number | string
  login?: number | string
  [key: string]: unknown
}

export interface DecodedJwt {
  header: Record<string, unknown>
  payload: JwtPayload
  signature: string
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64').toString('utf8')
}

export function decodeJwt(token: string): DecodedJwt {
  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.')
  if (parts.length !== 3) {
    throw new Error('JWT 格式不正确')
  }

  return {
    header: JSON.parse(decodeBase64Url(parts[0])) as Record<string, unknown>,
    payload: JSON.parse(decodeBase64Url(parts[1])) as JwtPayload,
    signature: parts[2]
  }
}

export function tokenExpiry(token: string): number | undefined {
  try {
    const payload = decodeJwt(token).payload
    if (payload.exp === undefined || payload.exp === null || payload.exp === '') {
      return undefined
    }
    const value = Number(payload.exp)
    return Number.isFinite(value) ? value : undefined
  } catch {
    return undefined
  }
}

export function maskToken(token: string): string {
  if (!token) return '(empty)'
  if (token.length <= 16) return `${token.slice(0, 4)}***${token.slice(-4)}`
  return `${token.slice(0, 10)}...${token.slice(-10)}`
}

