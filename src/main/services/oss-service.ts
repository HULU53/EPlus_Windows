import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import type { AttachmentKind, OssUploadConfig } from '@shared/types'
import { hmacSha1Base64, md5Base64, randomHex } from './crypto'

export interface OssUploadResult {
  objectKey: string
  url: string
}

export class OssService {
  async uploadFile(params: {
    config: OssUploadConfig
    kind: AttachmentKind
    userId: string
    localPath: string
  }): Promise<OssUploadResult> {
    const bytes = readFileSync(params.localPath)
    const extension =
      extname(params.localPath) ||
      (params.kind === 'xml' ? '.xml' : params.kind === 'speex' ? '.speex' : '.mp3')
    const prefix =
      params.kind === 'xml'
        ? params.config.xmlPath
        : params.kind === 'speex'
          ? params.config.spxPath
          : params.config.mp3Path
    const objectKey = `${prefix}public_${randomHex(32).toLowerCase()}_${Date.now()}${extension}`
    const contentType = 'application/octet-stream'
    const contentMd5 = md5Base64(bytes)
    const date = new Date().toUTCString()
    const canonicalizedResource = `/${params.config.bucket}/${objectKey}`
    const canonicalizedHeaders =
      `x-oss-object-acl:public-read\n` +
      `x-oss-security-token:${params.config.securityToken}\n`
    const stringToSign =
      `PUT\n` +
      `${contentMd5}\n` +
      `${contentType}\n` +
      `${date}\n` +
      `${canonicalizedHeaders}${canonicalizedResource}`
    const signature = hmacSha1Base64(params.config.accessKeySecret, stringToSign)
    const url = `https://${params.config.bucket}.${params.config.endpoint}/${objectKey}`

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `OSS ${params.config.accessKeyId}:${signature}`,
        'x-oss-object-acl': 'public-read',
        'x-oss-security-token': params.config.securityToken,
        Date: date,
        'Content-MD5': contentMd5,
        'Content-Type': contentType,
        'Content-Length': String(bytes.length)
      },
      body: bytes
    })
    if (!response.ok) {
      throw new Error(`OSS 上传失败 HTTP ${response.status}: ${await response.text()}`)
    }

    return {
      objectKey,
      url: `${params.config.cname.replace(/\/+$/, '')}/${objectKey}`
    }
  }
}

