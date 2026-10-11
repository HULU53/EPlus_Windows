import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { generateZipPassword } from './zip-password'

function md5Upper(value: Buffer): string {
  return createHash('md5').update(value).digest('hex').toUpperCase()
}

describe('generateZipPassword', () => {
  it('generates the 64 character footer password', () => {
    const footer = Buffer.alloc(336)
    footer.write('MSTCHINA', 0, 'ascii')
    const seed = Buffer.alloc(128, 7)
    seed.copy(footer, 16)
    const zip = Buffer.concat([Buffer.from('PK\x03\x04'), footer])

    const first = md5Upper(seed)
    const expected = `${first}${md5Upper(Buffer.from(first, 'ascii'))}`
    expect(generateZipPassword(zip)).toBe(expected)
  })

  it('rejects a missing signature', () => {
    expect(() => generateZipPassword(Buffer.alloc(400))).toThrow(/MSTCHINA/)
  })
})

