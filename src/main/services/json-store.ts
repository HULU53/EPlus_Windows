import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname } from 'node:path'

export class JsonStore<T> {
  constructor(
    private readonly filePath: string,
    private readonly fallback: T
  ) {}

  read(): T {
    if (!existsSync(this.filePath)) {
      this.write(this.fallback)
      return structuredClone(this.fallback)
    }

    try {
      return JSON.parse(readFileSync(this.filePath, 'utf8')) as T
    } catch {
      return structuredClone(this.fallback)
    }
  }

  write(value: T): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temporary = `${this.filePath}.tmp`
    const serialized = JSON.stringify(value, null, 2)
    writeFileSync(temporary, serialized, 'utf8')
    try {
      renameSync(temporary, this.filePath)
    } catch {
      writeFileSync(this.filePath, serialized, 'utf8')
      if (existsSync(temporary)) unlinkSync(temporary)
    }
  }

  update(updater: (value: T) => T): T {
    const next = updater(this.read())
    this.write(next)
    return next
  }
}

