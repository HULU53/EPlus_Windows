import { sha1 } from './crypto'
import type {
  Paper,
  PaperSection,
  Question,
  UploadContext
} from '@shared/types'
import { scoreForPart } from '@shared/scoring'
import {
  ETS_EVALUATE_RESOURCE_ID,
  PAPER_CACHE_VERSION
} from '@shared/constants'

function text(value: unknown): string {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p><p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\u200B/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
}

function findDeep(source: unknown, keys: string[]): unknown {
  if (!source || typeof source !== 'object') return undefined
  const record = source as Record<string, unknown>
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key]
    }
  }
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findDeep(item, keys)
        if (found !== undefined) return found
      }
    } else {
      const found = findDeep(value, keys)
      if (found !== undefined) return found
    }
  }
  return undefined
}

function makeContext(
  json: Record<string, unknown>,
  homeworkId: string,
  order: number,
  contextBase: { setId?: string; resourceId?: string } = {}
): UploadContext {
  return {
    homeworkId,
    resourceId:
      contextBase.resourceId ||
      String(findDeep(json, ['resource_id', 'resourceId']) ?? ETS_EVALUATE_RESOURCE_ID),
    setId:
      contextBase.setId ||
      String(findDeep(json, ['set_id', 'setId']) ?? ''),
    entityId: String(findDeep(json, ['entity_id', 'entityId', 'stid']) ?? ''),
    order: String(findDeep(json, ['order']) ?? order),
    serialId: String(findDeep(json, ['serial_id', 'serialId']) ?? '0'),
    useTime: Number(findDeep(json, ['use_time', 'useTime']) ?? 0),
    score: String(findDeep(json, ['score']) ?? '0.0'),
    correct: Number(findDeep(json, ['correct']) ?? 1)
  }
}

function questionFromRole(
  entry: Record<string, unknown>,
  base: Omit<Question, 'id' | 'questionText' | 'answers' | 'originalText' | 'category' | 'uploadContext' | 'attachments'>,
  homeworkId: string,
  json: Record<string, unknown>,
  contextBase: { setId?: string; resourceId?: string }
): Question {
  const std = Array.isArray(entry.std) ? entry.std : []
  const answers = std
    .map((item) => text((item as Record<string, unknown>).value))
    .filter(Boolean)
  return {
    ...base,
    id: sha1(`${homeworkId}:${base.contentUrl}:${base.order}`),
    questionText: text(entry.ask ?? entry.question ?? entry.topic),
    answers,
    originalText: text(entry.value ?? ''),
    category: text(entry.category ?? ''),
    uploadContext: makeContext(json, homeworkId, base.order, contextBase),
    attachments: []
  }
}

export function parseContentJson(
  jsonText: string,
  homeworkId: string,
  contentUrl: string,
  groupName: string,
  contextBase: { setId?: string; resourceId?: string; orderOffset?: number } = {}
): PaperSection {
  const json = JSON.parse(jsonText) as Record<string, unknown>
  const structureType = String(json.structure_type ?? '')
  const info = (json.info ?? {}) as Record<string, unknown>
  const questions: Question[] = []
  const maxScore = scoreForPart(groupName)
  const orderOffset = contextBase.orderOffset ?? 0

  const itemOrder = (index: number, entry?: Record<string, unknown>) => {
    const local = Number(entry?.xh ?? entry?.xth ?? entry?.xt_xh)
    return orderOffset + (Number.isFinite(local) && local > 0 ? local : index + 1)
  }

  const base = (index: number, entry?: Record<string, unknown>) => ({
    homeworkId,
    contentUrl,
    order: itemOrder(index, entry),
    sectionOrder: itemOrder(index, entry),
    sectionCaption: groupName,
    typeName: groupName,
    structureType,
    partName: groupName,
    maxScore
  })

  if (structureType === 'collector.choose') {
    const list = Array.isArray(info.xtlist) ? info.xtlist : []
    list.forEach((raw, index) => {
      const entry = raw as Record<string, unknown>
      const options = Array.isArray(entry.xxlist)
        ? entry.xxlist.map((option) => {
            const item = option as Record<string, unknown>
            return {
              label: String(item.xx_mc ?? ''),
              text: text(item.xx_nr)
            }
          })
        : []
      const answer = text(entry.answer)
      const order = itemOrder(index, entry)
      questions.push({
        ...base(index, entry),
        id: sha1(`${homeworkId}:${contentUrl}:${order}`),
        questionText: text(entry.xt_nr),
        answers: answer ? [answer] : [],
        options,
        correctAnswer: answer,
        originalText: options.map((option) => `${option.label}. ${option.text}`).join('\n'),
        uploadContext: makeContext(json, homeworkId, order, contextBase),
        attachments: []
      })
    })
    return { caption: groupName, typeName: groupName, structureType, questions, originalContent: JSON.stringify(json) }
  }

  if (structureType === 'collector.fill') {
    const list = Array.isArray(info.std) ? info.std : []
    list.forEach((raw, index) => {
      const entry = raw as Record<string, unknown>
      const order = itemOrder(index, entry)
      questions.push({
        ...base(index, entry),
        order,
        sectionOrder: order,
        id: sha1(`${homeworkId}:${contentUrl}:${order}`),
        questionText: text(entry.xth ?? `第 ${order} 题`),
        answers: [text(entry.value)].filter(Boolean),
        uploadContext: makeContext(json, homeworkId, order, contextBase),
        attachments: []
      })
    })
    return { caption: groupName, typeName: groupName, structureType, questions, originalContent: JSON.stringify(json) }
  }

  if (
    structureType === 'collector.role' ||
    structureType === 'collector.3q5a' ||
    structureType === 'collector.dialogue'
  ) {
    const list = Array.isArray(info.question) ? info.question : []
    list.forEach((raw, index) => {
      questions.push(
        questionFromRole(
          raw as Record<string, unknown>,
          base(index, raw as Record<string, unknown>),
          homeworkId,
          json,
          contextBase
        )
      )
    })
    return { caption: groupName, typeName: groupName, structureType, questions, originalContent: JSON.stringify(json) }
  }

  if (structureType === 'collector.picture') {
    const list = Array.isArray(info.std) ? info.std : []
    const order = itemOrder(0, {})
    questions.push({
      ...base(0),
      order,
      sectionOrder: order,
      id: sha1(`${homeworkId}:${contentUrl}:${order}`),
      questionText: text(info.topic ?? groupName),
      answers: list.map((entry) => text((entry as Record<string, unknown>).value)).filter(Boolean),
      originalText: text(info.value),
      uploadContext: makeContext(json, homeworkId, order, contextBase),
      attachments: []
    })
    return { caption: groupName, typeName: groupName, structureType, questions, originalContent: JSON.stringify(json) }
  }

  const readText = text(info.value ?? info.std ?? '')
  const readOrder = itemOrder(0, {})
  questions.push({
    ...base(0),
    order: readOrder,
    sectionOrder: readOrder,
    id: sha1(`${homeworkId}:${contentUrl}:read`),
    questionText: groupName,
    answers: [],
    originalText: readText,
    uploadContext: makeContext(json, homeworkId, readOrder, contextBase),
    attachments: []
  })
  return { caption: groupName, typeName: groupName, structureType, questions, originalContent: JSON.stringify(json) }
}

export function createEmptyPaper(
  homeworkId: string,
  homeworkName: string,
  baseUrl: string
): Paper {
  return {
    id: sha1(`${homeworkId}:${homeworkName}:${baseUrl}`),
    homeworkId,
    homeworkName,
    title: homeworkName,
    baseUrl,
    resourceId: ETS_EVALUATE_RESOURCE_ID,
    parserVersion: PAPER_CACHE_VERSION,
    sections: [],
    createdAt: Date.now()
  }
}

