import { app } from 'electron'
import { join } from 'node:path'
import type { AppSettings } from '@shared/types'
import { JsonStore } from './json-store'

const DEFAULT_SETTINGS: AppSettings = {
  settingsVersion: 1,
  theme: 'system',
  dryRun: true,
  ffmpegPath: 'ffmpeg',
  maxDownloads: 2,
  keepOssObjectsInDryRun: true,
  logRetentionDays: 14,
  loggingEnabled: false,
  logLevel: 'debug',
  experimentalCustomScoreEnabled: false
}

export class SettingsService {
  private readonly store = new JsonStore<AppSettings>(
    join(app.getPath('userData'), 'settings.json'),
    DEFAULT_SETTINGS
  )

  get(): AppSettings {
    const stored = this.store.read()
    if (!stored.settingsVersion) {
      const migrated: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...stored,
        settingsVersion: 1,
        loggingEnabled: false
      }
      this.store.write(migrated)
      return migrated
    }
    return { ...DEFAULT_SETTINGS, ...stored }
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

