import { app } from 'electron'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import type { LogLevel } from '@shared/types'

const LOG_FILE_MAX_BYTES = 5 * 1024 * 1024
const LEVEL_WEIGHT: Record<LogLevel, number> = {
  error: 0,
  info: 1,
  debug: 2
}

let enabled = true
let level: LogLevel = 'debug'

const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /(password|token|accessKeySecret|securityToken|suc_user_token)\s*[:=]\s*["']?[^"',\s]+/gi
]
const SENSITIVE_KEY =
  /(password|passwd|token|authorization|cookie|secret|securityToken|accessKeySecret|suc_user_token)/i

export function getLogFilePath(): string {
  return join(app.getPath('temp'), 'Ets100Destop', 'Debug.txt')
}

export function configureLogger(config: { enabled: boolean; level: LogLevel }): void {
  enabled = config.enabled
  level = config.level
  ensureLogDirectory()
  writeLine('info', 'Logger', `日志已配置：enabled=${enabled}, level=${level}`)
}

export function redact(value: unknown): string {
  let text =
    typeof value === 'string'
      ? value
      : JSON.stringify(safeValue(value), null, 0)
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, (match) => {
      const separator = match.includes(':') ? ':' : '='
      const key = match.split(separator)[0]
      return `${key}${separator}***`
    })
  }
  return text
}

export function logDebug(scope: string, message: string, data?: unknown): void {
  writeLine('debug', scope, message, data)
}

export function logInfo(scope: string, message: string, data?: unknown): void {
  writeLine('info', scope, message, data)
}

export function logWarn(scope: string, message: string, data?: unknown): void {
  writeLine('info', scope, `WARN ${message}`, data)
}

export function logError(scope: string, message: string, error?: unknown): void {
  writeLine('error', scope, message, error)
}

function writeLine(targetLevel: LogLevel, scope: string, message: string, data?: unknown): void {
  const suffix = data === undefined ? '' : ` ${redact(data)}`
  const line = `[${new Date().toISOString()}] [${targetLevel.toUpperCase()}] [${scope}] ${message}${suffix}`

  if (targetLevel === 'error') {
    console.error(line)
  } else if (targetLevel === 'info') {
    console.info(line)
  } else {
    console.debug(line)
  }

  if (!enabled || LEVEL_WEIGHT[targetLevel] > LEVEL_WEIGHT[level]) return
  try {
    ensureLogDirectory()
    rotateIfNeeded()
    appendFileSync(getLogFilePath(), `${line}\n`, 'utf8')
  } catch (error) {
    console.error('Failed to write log file', error)
  }
}

function ensureLogDirectory(): void {
  mkdirSync(dirname(getLogFilePath()), { recursive: true })
}

function rotateIfNeeded(): void {
  const path = getLogFilePath()
  if (!existsSync(path) || statSync(path).size < LOG_FILE_MAX_BYTES) return
  const previous = `${path}.previous`
  if (existsSync(previous)) writeFileSync(previous, '', 'utf8')
  renameSync(path, previous)
}

function safeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.split('\n').slice(0, 12).join('\n'),
      cause: value.cause ? safeValue(value.cause, depth + 1) : undefined
    }
  }
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return `<bytes:${value.byteLength}>`
  }
  if (typeof value === 'string') {
    return value.length > 500 ? `${value.slice(0, 500)}...<${value.length} chars>` : value
  }
  if (typeof value !== 'object') return value
  if (depth >= 5) return '<object>'
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => safeValue(item, depth + 1))
  }
  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
    result[key] = SENSITIVE_KEY.test(key) ? '***' : safeValue(child, depth + 1)
  }
  return result
}
