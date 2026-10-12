import type { Question, ScoreData } from '@shared/types'

export type XmlPresetCategory = 'simple_expression' | 'topic' | 'read_chapter'

export interface XmlPresetResult {
  category: XmlPresetCategory
  fileName: string
  xml: string
  score: ScoreData
}

const INTERNAL_FULL_SCORE = 5

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function sourceText(question: Question): string {
  return (
    question.originalText?.trim() ||
    question.answers[0]?.trim() ||
    question.questionText.trim() ||
    'full score'
  )
}

function words(text: string): string[] {
  return text.split(/\s+/).map((item) => item.trim()).filter(Boolean)
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function wordTags(text: string, score: number): string {
  const list = words(text)
  let cursor = 0
  return list
    .map((word) => {
      const start = text.indexOf(word, cursor)
      const begin = start >= 0 ? start : cursor
      const end = begin + Math.max(word.length - 1, 0)
      cursor = end + 1
      return `          <word beg_pos="${begin}" content="${escapeXml(word)}" end_pos="${end}" total_score="${score.toFixed(6)}"/>`
    })
    .join('\n')
}

function fullScore(category: XmlPresetCategory): ScoreData {
  const value = INTERNAL_FULL_SCORE.toFixed(1)
  return {
    totalScore: value,
    choose: '',
    fluencyScore: value,
    accuracyScore: value,
    integrityScore: value,
    standardScore: value,
    category,
    repeatMode: '0',
    version: '7.0.71.2569(2569)',
    rateScale: 0,
    source: 'manual'
  }
}

function simpleExpression(question: Question, internalScore: number): string {
  const content = sourceText(question)
  const keyword = words(content)[0] ?? content
  return `<xml_result>
  <simple_expression lan="en" region="beijing" region_version="1" type="study" version="1.0.2.1005">
    <rec_paper>
      <rec_paper beg_pos="0" content="rec_paper" end_pos="${content.length}" except_info="0" is_rejected="false" keywords="${escapeXml(keyword)}" missingscore_type="2" phone_score="${internalScore.toFixed(6)}" reject_type="0" total_score="${internalScore.toFixed(6)}" word_hit_of_each_kw="1.00">
        <sentence content="${escapeXml(content)}" index="0">
${wordTags(content, internalScore)}
        </sentence>
      </rec_paper>
    </rec_paper>
  </simple_expression>
</xml_result>`
}

function topic(question: Question, internalScore: number): string {
  const content = sourceText(question)
  const keypoints = words(content).slice(0, 8)
  return `<xml_result>
  <topic lan="en" region="beijing" region_version="1" type="study" version="V4.1.0R6.81.20.38M5.81.38.0">
    <rec_paper>
      <rec_paper accuracy_score="${internalScore.toFixed(6)}" beg_pos="0" content="rec_paper" end_pos="${content.length}" except_info="0" fluency_score="${internalScore.toFixed(6)}" integrity_score="${internalScore.toFixed(6)}" is_rejected="false" keypoints="${escapeXml(keypoints.join('|'))}" phone_score="${internalScore.toFixed(6)}" reject_type="0" speaking_speed="120.000000" total_score="${internalScore.toFixed(6)}" word_hit_of_each_kp="${keypoints.map(() => '1.00').join('|')}">
        <sentence content="${escapeXml(content)}" index="0">
${wordTags(content, internalScore)}
        </sentence>
      </rec_paper>
    </rec_paper>
  </topic>
</xml_result>`
}

function readChapter(question: Question, internalScore: number): string {
  const content = sourceText(question)
  const sentenceNodes = sentences(content)
    .map((sentence, sentenceIndex) => {
      const list = words(sentence)
      const wordNodes = list
        .map((word, wordIndex) => {
          const begin = content.indexOf(word)
          return `            <word beg_pos="${Math.max(begin, 0)}" content="${escapeXml(word)}" dp_message="0" end_pos="${Math.max(begin, 0) + word.length}" global_index="${wordIndex}" index="${wordIndex}" property="12" total_score="${internalScore.toFixed(6)}" werr_msg="0" werr_msg_multi="0">
              <syll beg_pos="${Math.max(begin, 0)}" content="${escapeXml(word)}" end_pos="${Math.max(begin, 0) + word.length}" serr_msg="0" syll_accent="0" syll_score="${internalScore.toFixed(6)}">
                <phone beg_pos="${Math.max(begin, 0)}" content="${escapeXml(word)}" first_best="${escapeXml(word)}" phone_asr_top3="${escapeXml(word)}" phone_error_prob="0.000000"/>
              </syll>
            </word>`
        })
        .join('\n')
      return `        <sentence accuracy_score="${internalScore.toFixed(6)}" beg_pos="0" content="${escapeXml(sentence)}" end_pos="${sentence.length}" fluency_score="${internalScore.toFixed(6)}" index="${sentenceIndex}" standard_score="${internalScore.toFixed(6)}" total_score="${internalScore.toFixed(6)}" word_count="${list.length}">
${wordNodes}
        </sentence>`
    })
    .join('\n')

  return `<xml_result>
  <read_chapter lan="en" type="study" version="V4.2.0R6.62.46.9M4.62.46.9">
    <rec_paper>
      <read_chapter accuracy_score="${internalScore.toFixed(6)}" beg_pos="0" content="${escapeXml(content)}" continus_deduct_score="0.000000" end_pos="${content.length}" except_info="0" fluency_score="${internalScore.toFixed(6)}" improper_cnt="0.000000" integrity_score="${internalScore.toFixed(6)}" is_rejected="false" reject_type="0" rising_tone_deduct_score="0.000000" score_pattern="strict" skill_deduct_score="0.000000" standard_score="${internalScore.toFixed(6)}" stress_deduct_score="0.000000" total_score="${internalScore.toFixed(6)}" word_count="${words(content).length}" words_per_min="120.000000">
${sentenceNodes}
      </read_chapter>
    </rec_paper>
  </read_chapter>
</xml_result>`
}

export function generateFullScoreXml(
  question: Question,
  internalScore = INTERNAL_FULL_SCORE,
  allowOverflow = false
): XmlPresetResult {
  let category: XmlPresetCategory = 'simple_expression'
  if (question.structureType === 'collector.picture' || /转述/.test(question.typeName)) {
    category = 'topic'
  } else if (question.structureType === 'collector.read' || /朗读/.test(question.typeName)) {
    category = 'read_chapter'
  }

  const xml =
    category === 'topic'
      ? topic(question, internalScore)
      : category === 'read_chapter'
        ? readChapter(question, internalScore)
        : simpleExpression(question, internalScore)

  return {
    category,
    fileName: `full-score-${category}.xml`,
    xml,
    score: {
      ...fullScore(category),
      totalScore: internalScore.toFixed(6),
      fluencyScore: internalScore.toFixed(6),
      accuracyScore: internalScore.toFixed(6),
      integrityScore: internalScore.toFixed(6),
      standardScore: internalScore.toFixed(6),
      allowOverflow
    }
  }
}
