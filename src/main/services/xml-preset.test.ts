import { describe, expect, it } from 'vitest'
import type { Question } from '@shared/types'
import { choiceScore, scoreForPart } from '@shared/scoring'
import { generateFullScoreXml } from './xml-preset'

function question(patch: Partial<Question>): Question {
  return {
    id: 'q1',
    homeworkId: 'h1',
    contentUrl: 'content.zip',
    order: 1,
    sectionOrder: 1,
    sectionCaption: 'test',
    typeName: 'test',
    structureType: 'collector.role',
    questionText: 'question',
    answers: [],
    originalText: 'her brother helps her',
    attachments: [],
    ...patch
  }
}

describe('generateFullScoreXml', () => {
  it('generates a simple expression full-score XML', () => {
    const result = generateFullScoreXml(question({}))
    expect(result.category).toBe('simple_expression')
    expect(result.xml).toContain('total_score="5.000000"')
    expect(result.score.totalScore).toBe('5.000000')
  })

  it('generates a topic full-score XML', () => {
    const result = generateFullScoreXml(
      question({ structureType: 'collector.picture', typeName: '听后转述' })
    )
    expect(result.category).toBe('topic')
    expect(result.xml).toContain('<topic')
    expect(result.xml).toContain('word_hit_of_each_kp=')
  })

  it('generates a read chapter full-score XML', () => {
    const result = generateFullScoreXml(
      question({ structureType: 'collector.read', typeName: '短文朗读' })
    )
    expect(result.category).toBe('read_chapter')
    expect(result.xml).toContain('<read_chapter')
    expect(result.xml).toContain('<syll')
  })

  it('uses the official display maximums and internal five-point XML scale', () => {
    expect(scoreForPart('听后选择')).toBe(1.5)
    expect(scoreForPart('听后回答')).toBe(2)
    expect(scoreForPart('听后转述')).toBe(10)
    expect(scoreForPart('短文朗读')).toBe(9)

    const topic = generateFullScoreXml(
      question({ partName: '听后转述', maxScore: 10, typeName: '听后转述' })
    )
    expect(topic.score.totalScore).toBe('5.000000')
    expect(topic.xml).toContain('total_score="5.000000"')

    const reading = generateFullScoreXml(
      question({
        structureType: 'collector.read',
        partName: '短文朗读',
        maxScore: 9,
        typeName: '短文朗读'
      })
    )
    expect(reading.score.totalScore).toBe('5.000000')
    expect(reading.xml).toContain('total_score="5.000000"')
  })

  it('calculates choice scores from the selected answer', () => {
    expect(choiceScore('A', 'A', 1.5)).toBe(1.5)
    expect(choiceScore('B', 'A', 1.5)).toBe(0)
    expect(choiceScore('', 'A', 1.5)).toBe(0)
  })

  it('allows custom internal scores above five when overflow is enabled', () => {
    const result = generateFullScoreXml(
      question({ structureType: 'collector.picture' }),
      6.25,
      true
    )
    expect(result.score.totalScore).toBe('6.250000')
    expect(result.score.allowOverflow).toBe(true)
    expect(result.xml).toContain('total_score="6.250000"')
  })
})
