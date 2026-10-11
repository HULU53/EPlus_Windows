import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AccountSession } from '@shared/types'

export class SessionStore {
  private readonly path = join(app.getPath('userData'), 'session.enc')
  private readonly devicePath = join(app.getPath('userData'), 'device-code.txt')

  read(): AccountSession | null {
    if (!existsSync(this.path)) return null
    try {
      const encoded = readFileSync(this.path, 'utf8')
      const json = Buffer.from(encoded, 'base64')
      const text = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(json)
        : json.toString('utf8')
      return JSON.parse(text) as AccountSession
    } catch {
      this.clear()
      return null
    }
  }

  write(session: AccountSession): void {
    mkdirSync(app.getPath('userData'), { recursive: true })
    const json = JSON.stringify(session)
    const payload = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(json)
      : Buffer.from(json, 'utf8')
    writeFileSync(this.path, payload.toString('base64'), 'utf8')
  }

  clear(): void {
    if (existsSync(this.path)) {
      unlinkSync(this.path)
    }
  }

  readDeviceCode(): string | null {
    if (!existsSync(this.devicePath)) return null
    try {
      const encoded = readFileSync(this.devicePath, 'utf8')
      const buffer = Buffer.from(encoded, 'base64')
      return safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(buffer)
        : buffer.toString('utf8')
    } catch {
      return null
    }
  }

  writeDeviceCode(deviceCode: string): void {
    mkdirSync(app.getPath('userData'), { recursive: true })
    const payload = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(deviceCode)
      : Buffer.from(deviceCode, 'utf8')
    writeFileSync(this.devicePath, payload.toString('base64'), 'utf8')
  }
}

