import { describe, expect, it } from 'vitest'
import {
  formatLocalDateTime,
  normalizeInternalScore,
  parseScoreXml,
  scoreDataToJson
} from './score-parser'

describe('parseScoreXml', () => {
  it('extracts attributes from the captured XML shape', () => {
    const score = parseScoreXml(`
      <xml_result>
        <simple_expression category="simple_expression">
          <rec_paper>
            <rec_paper
              phone_score="2.145689"
              total_score="2.234918"
              accuracy_score="1.5"
              fluency_score="0.4"
              integrity_score="0.3"
            />
          </rec_paper>
        </simple_expression>
      </xml_result>
    `)

    expect(score.totalScore).toBe('2.234918')
    expect(score.accuracyScore).toBe('1.5')
    expect(score.source).toBe('xml')
  })

  it('serializes exactly the captured score_detail field names', () => {
    const value = JSON.parse(
      scoreDataToJson({
        totalScore: '1.2',
        choose: '',
        fluencyScore: '0.3',
        accuracyScore: '0.6',
        integrityScore: '0.3',
        standardScore: '0.0',
        category: 'simple_expression',
        repeatMode: '0',
        version: '7.0.71.2569(2569)',
        rateScale: 0,
        source: 'xml'
      })
    )
    expect(value.total_score).toBe('1.2')
    expect(value.accuracy_score).toBe('0.6')
    expect(value.source).toBeUndefined()
  })

  it('formats client time as local YYYY-MM-DD HH:mm:ss', () => {
    expect(formatLocalDateTime(new Date(2026, 9, 7, 19, 35, 45))).toBe(
      '2026-10-07 19:35:45'
    )
  })

  it('clamps internal scoring fields to five', () => {
    const normalized = normalizeInternalScore({
      totalScore: '10',
      choose: '',
      fluencyScore: '20',
      accuracyScore: '9',
      integrityScore: '-1',
      standardScore: '4.5',
      category: 'topic',
      repeatMode: '0',
      version: '7.0.71.2569(2569)',
      rateScale: 0,
      source: 'manual'
    })
    expect(normalized.totalScore).toBe('5.0')
    expect(normalized.fluencyScore).toBe('5.0')
    expect(normalized.accuracyScore).toBe('5.0')
    expect(normalized.integrityScore).toBe('0.0')
    expect(normalized.standardScore).toBe('4.5')
  })

  it('preserves custom overflow scores with decimal precision', () => {
    const normalized = normalizeInternalScore({
      totalScore: '0.416667',
      choose: '',
      fluencyScore: '0',
      accuracyScore: '0',
      integrityScore: '0',
      standardScore: '0',
      category: 'simple_expression',
      repeatMode: '0',
      version: '7.0.71.2569(2569)',
      rateScale: 0,
      source: 'manual',
      allowOverflow: true
    })
    expect(normalized.totalScore).toBe('0.416667')
  })
})
