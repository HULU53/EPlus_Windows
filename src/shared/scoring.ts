import type { Question } from './types'

export function scoreForPart(partName: string): number {
  if (/听后选择/.test(partName)) return 1.5
  if (/听后回答/.test(partName)) return 2
  if (/听后转述/.test(partName)) return 10
  if (/短文朗读/.test(partName)) return 9
  return 5
}

export function questionMaxScore(
  question: Pick<Question, 'maxScore' | 'partName' | 'typeName'>
): number {
  return question.maxScore ?? scoreForPart(question.partName || question.typeName || '')
}

export function choiceScore(
  selectedAnswer: string,
  correctAnswer: string | undefined,
  maxScore = 1.5
): number {
  if (!selectedAnswer || !correctAnswer) return 0
  return selectedAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase()
    ? maxScore
    : 0
}
