import { createHash } from 'node:crypto'
import {
  ZIP_FOOTER_SIZE,
  ZIP_SEED_END,
  ZIP_SEED_START
} from '@shared/constants'

function md5Upper(input: Buffer): string {
  return createHash('md5').update(input).digest('hex').toUpperCase()
}

export function generateZipPassword(zipData: Buffer): string {
  if (zipData.length < ZIP_FOOTER_SIZE) {
    throw new Error('ZIP 文件过小，无法读取尾部密码种子')
  }

  const footer = zipData.subarray(zipData.length - ZIP_FOOTER_SIZE)
  const signature1 = footer.subarray(0, 8).toString('ascii') === 'MSTCHINA'
  const signature2 = footer.subarray(144, 149).toString('ascii') === 'EPLAT'

  if (!signature1 && !signature2) {
    throw new Error('ZIP 尾部不包含 MSTCHINA 或 EPLAT 签名')
  }

  const seed = footer.subarray(ZIP_SEED_START, ZIP_SEED_END + 1)
  const first = md5Upper(seed)
  const second = md5Upper(Buffer.from(first, 'ascii'))
  return `${first}${second}`
}

