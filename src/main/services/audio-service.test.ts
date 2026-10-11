import { describe, expect, it } from 'vitest'
import { extractRawSpeexFromOgg } from './speex-ogg'

function oggPage(packets: Buffer[]): Buffer {
  const segments: number[] = []
  for (const packet of packets) {
    let remaining = packet.length
    while (remaining >= 255) {
      segments.push(255)
      remaining -= 255
    }
    segments.push(remaining)
  }
  const header = Buffer.alloc(27 + segments.length)
  header.write('OggS', 0, 'ascii')
  header[26] = segments.length
  Buffer.from(segments).copy(header, 27)
  return Buffer.concat([header, ...packets])
}

describe('extractRawSpeexFromOgg', () => {
  it('drops the two Speex headers and returns raw audio frames', () => {
    const header = Buffer.alloc(80)
    header.write('Speex   ', 0, 'ascii')
    const comment = Buffer.from('comment-header')
    const audio1 = Buffer.from([1, 2, 3])
    const audio2 = Buffer.from([4, 5, 6])
    const raw = extractRawSpeexFromOgg(
      oggPage([header, comment, audio1, audio2])
    )
    expect(raw).toEqual(Buffer.from([1, 2, 3, 4, 5, 6]))
  })
})
