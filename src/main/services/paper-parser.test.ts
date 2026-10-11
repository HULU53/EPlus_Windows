import { describe, expect, it } from 'vitest'
import { parseContentJson } from './paper-parser'

describe('parseContentJson', () => {
  it('parses six-choice packages with score and context', () => {
    const section = parseContentJson(
      JSON.stringify({
        structure_type: 'collector.choose',
        info: {
          stid: '618283',
          xtlist: [
            {
              xt_xh: '1',
              xt_nr: 'Question 1',
              answer: 'A',
              xxlist: [
                { xx_mc: 'A', xx_nr: 'Option A' },
                { xx_mc: 'B', xx_nr: 'Option B' }
              ]
            },
            {
              xt_xh: '2',
              xt_nr: 'Question 2',
              answer: 'B',
              xxlist: [
                { xx_mc: 'A', xx_nr: 'Option A' },
                { xx_mc: 'B', xx_nr: 'Option B' }
              ]
            }
          ]
        }
      }),
      'h1',
      'choice.zip',
      '听后选择',
      { setId: '574376', resourceId: '55', orderOffset: 0 }
    )

    expect(section.questions).toHaveLength(2)
    expect(section.questions[0].maxScore).toBe(1.5)
    expect(section.questions[0].options?.[0]).toEqual({ label: 'A', text: 'Option A' })
    expect(section.questions[0].uploadContext).toMatchObject({
      resourceId: '55',
      setId: '574376',
      entityId: '618283',
      order: '1'
    })
  })

  it('treats picture package as one topic question', () => {
    const section = parseContentJson(
      JSON.stringify({
        structure_type: 'collector.picture',
        info: {
          stid: '618291',
          topic: 'retell',
          value: 'original',
          std: [{ value: 'answer 1' }, { value: 'answer 2' }, { value: 'answer 3' }]
        }
      }),
      'h1',
      'topic.zip',
      '听后转述'
    )
    expect(section.questions).toHaveLength(1)
    expect(section.questions[0].maxScore).toBe(10)
    expect(section.questions[0].answers).toHaveLength(3)
  })

  it('assigns part-relative order and nine-point reading score', () => {
    const section = parseContentJson(
      JSON.stringify({
        structure_type: 'collector.read',
        info: { stid: '618355', value: 'Read this chapter.' }
      }),
      'h1',
      'read.zip',
      '短文朗读',
      { orderOffset: 13 }
    )
    expect(section.questions[0].maxScore).toBe(9)
    expect(section.questions[0].order).toBe(14)
    expect(section.questions[0].uploadContext?.entityId).toBe('618355')
  })
})
