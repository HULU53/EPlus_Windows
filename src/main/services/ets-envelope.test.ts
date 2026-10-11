import { describe, expect, it } from 'vitest'
import { createRequestSn } from './crypto'
import { buildEtsEnvelope, parseEtsResponse } from './ets-envelope'

describe('ETS envelope', () => {
  it('builds a deterministic grlx envelope', () => {
    const envelope = buildEtsEnvelope(
      'm/ecard/list',
      { token: 'demo', sn: 'test' },
      1716537600
    )

    expect(envelope.head.pid).toBe('grlx')
    expect(envelope.head.time).toBe(1716537600)
    expect(envelope.head.sign).toMatch(/^[a-f0-9]{32}$/)
    expect(JSON.parse(Buffer.from(envelope.body, 'base64').toString('utf8'))).toEqual([
      {
        r: 'm/ecard/list',
        params: { token: 'demo', sn: 'test' }
      }
    ])
  })

  it('normalizes array responses', () => {
    expect(parseEtsResponse([{ code: 0, body: { ok: true } }])).toEqual({
      code: 0,
      body: { ok: true }
    })
  })

  it('creates a captured-style request sn', () => {
    expect(createRequestSn(1791470792941)).toMatch(/^1791470792\d{7}$/)
  })
})

