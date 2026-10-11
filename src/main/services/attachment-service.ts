import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { AttachmentKind, QuestionAttachment } from '@shared/types'
import { randomId } from './crypto'

export class AttachmentService {
  private readonly directory = join(app.getPath('userData'), 'attachments')

  constructor() {
    mkdirSync(this.directory, { recursive: true })
  }

  saveBuffer(params: {
    kind: AttachmentKind
    fileName: string
    mimeType: string
    bytes: Uint8Array
    source: 'file' | 'recording' | 'generated'
  }): QuestionAttachment {
    const id = randomId()
    const extension = extname(params.fileName) || this.defaultExtension(params.kind)
    const localPath = join(this.directory, `${id}${extension}`)
    writeFileSync(localPath, params.bytes)
    return {
      id,
      kind: params.kind,
      fileName: params.fileName,
      mimeType: params.mimeType,
      size: params.bytes.byteLength,
      localPath,
      createdAt: Date.now(),
      source: params.source
    }
  }

  saveExistingFile(params: {
    kind: AttachmentKind
    fileName: string
    mimeType: string
    sourcePath: string
    source?: 'file' | 'recording' | 'generated'
  }): QuestionAttachment {
    const id = randomId()
    const extension = extname(params.fileName) || this.defaultExtension(params.kind)
    const localPath = join(this.directory, `${id}${extension}`)
    copyFileSync(params.sourcePath, localPath)
    return {
      id,
      kind: params.kind,
      fileName: params.fileName,
      mimeType: params.mimeType,
      size: readFileSync(localPath).length,
      localPath,
      createdAt: Date.now(),
      source: params.source ?? 'file'
    }
  }

  remove(attachment: QuestionAttachment): void {
    if (existsSync(attachment.localPath)) {
      unlinkSync(attachment.localPath)
    }
  }

  private defaultExtension(kind: AttachmentKind): string {
    if (kind === 'xml') return '.xml'
    if (kind === 'speex') return '.speex'
    return '.mp3'
  }
}

