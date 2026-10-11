import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID
} from 'node:crypto'

export function md5(input: string | Buffer): string {
  return createHash('md5').update(input).digest('hex')
}

export function sha1(input: string | Buffer): string {
  return createHash('sha1').update(input).digest('hex')
}

export function base64(input: string | Buffer): string {
  return Buffer.from(input).toString('base64')
}

export function md5Base64(input: string | Buffer): string {
  return createHash('md5').update(input).digest('base64')
}

export function hmacSha1Base64(secret: string, input: string): string {
  return createHmac('sha1', secret).update(input, 'utf8').digest('base64')
}

export function randomHex(length: number): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length)
    .toUpperCase()
}

export function randomId(): string {
  return randomUUID()
}

export function createRequestSn(nowMs = Date.now()): string {
  const seconds = Math.floor(nowMs / 1000)
  const random = randomBytes(4).readUInt32BE(0) % 10_000_000
  return `${seconds}${String(random).padStart(7, '0')}`
}

