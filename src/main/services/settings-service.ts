import { app } from 'electron'
import { join } from 'node:path'
import type { AppSettings } from '@shared/types'
import { JsonStore } from './json-store'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  dryRun: true,
  ffmpegPath: 'ffmpeg',
  maxDownloads: 2,
  keepOssObjectsInDryRun: true,
  logRetentionDays: 14,
  loggingEnabled: true,
  logLevel: 'debug'
}

export class SettingsService {
  private readonly store = new JsonStore<AppSettings>(
    join(app.getPath('userData'), 'settings.json'),
    DEFAULT_SETTINGS
  )

  get(): AppSettings {
    return {
      ...DEFAULT_SETTINGS,
      ...this.store.read()
    }
  }

  update(patch: Partial<AppSettings>): AppSettings {
    return this.store.update((current) => ({
      ...DEFAULT_SETTINGS,
      ...current,
      ...patch,
      maxDownloads: Math.min(
        Math.max(Number(patch.maxDownloads ?? current.maxDownloads ?? DEFAULT_SETTINGS.maxDownloads), 1),
        4
      )
    }))
  }
}

