import { XMLParser } from 'fast-xml-parser'
import type { ScoreData } from '@shared/types'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false
})

function walk(value: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (!value || typeof value !== 'object') return
  const node = value as Record<string, unknown>
  visit(node)
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) {
      child.forEach((item) => walk(item, visit))
    } else {
      walk(child, visit)
    }
  }
}

function pickAttribute(
  roots: Record<string, unknown>[],
  candidates: string[],
  fallback = '0.0'
): string {
  for (const root of roots) {
    for (const candidate of candidates) {
      const direct = root[`@_${candidate}`]
      if (direct !== undefined && direct !== null && direct !== '') {
        return String(direct)
      }
    }
  }
  return fallback
}

export function defaultScore(category = 'simple_expression'): ScoreData {
  return {
    totalScore: '0.0',
    choose: '',
    fluencyScore: '0.0',
    accuracyScore: '0.0',
    integrityScore: '0.0',
    standardScore: '0.0',
    category,
    repeatMode: '0',
    version: '7.0.71.2569(2569)',
    rateScale: 0,
    source: 'default'
  }
}

export function parseScoreXml(xml: string, category = 'simple_expression'): ScoreData {
  const parsed = parser.parse(xml) as Record<string, unknown>
  const nodes: Record<string, unknown>[] = []
  walk(parsed, (node) => nodes.push(node))

  const totalScore = pickAttribute(nodes, ['total_score', 'phone_score'], '0.0')
  return {
    totalScore,
    choose: pickAttribute(nodes, ['choose'], ''),
    fluencyScore: pickAttribute(nodes, ['fluency_score'], '0.0'),
    accuracyScore: pickAttribute(nodes, ['accuracy_score'], '0.0'),
    integrityScore: pickAttribute(nodes, ['integrity_score'], '0.0'),
    standardScore: pickAttribute(nodes, ['standard_score'], '0.0'),
    category:
      pickAttribute(nodes, ['category'], category) || category,
    repeatMode: pickAttribute(nodes, ['repeat_mode'], '0'),
    version: pickAttribute(nodes, ['version'], '7.0.71.2569(2569)'),
    rateScale: Number(pickAttribute(nodes, ['rate_scale'], '0')) || 0,
    source: 'xml'
  }
}

export function scoreDataToJson(score: ScoreData): string {
  return JSON.stringify({
    total_score: score.totalScore,
    choose: score.choose,
    fluency_score: score.fluencyScore,
    accuracy_score: score.accuracyScore,
    integrity_score: score.integrityScore,
    standard_score: score.standardScore,
    category: score.category,
    repeat_mode: score.repeatMode,
    version: score.version,
    rate_scale: score.rateScale
  })
}

export function normalizeInternalScore(score: ScoreData): ScoreData {
  const clamp = (value: string): string => {
    const number = Number(value)
    if (!Number.isFinite(number)) return '0.0'
    const lowerBounded = Math.max(number, 0)
    const bounded = score.allowOverflow ? lowerBounded : Math.min(lowerBounded, 5)
    return bounded.toFixed(score.allowOverflow ? 6 : 1)
  }
  return {
    ...score,
    totalScore: clamp(score.totalScore),
    fluencyScore: clamp(score.fluencyScore),
    accuracyScore: clamp(score.accuracyScore),
    integrityScore: clamp(score.integrityScore),
    standardScore: clamp(score.standardScore)
  }
}

export function formatLocalDateTime(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

