import { existsSync } from 'node:fs'
import type {
  AccountSession,
  AppSettings,
  AttachmentKind,
  Paper,
  Question,
  QuestionAttachment,
  ScoreData,
  UploadContext,
  UploadRequest
} from '@shared/types'
import { AudioService } from './audio-service'
import { EtsApiClient } from './ets-api'
import { OssService } from './oss-service'
import { PaperService } from './paper-service'
import {
  normalizeInternalScore,
  parseScoreXml,
  scoreDataToJson
} from './score-parser'
import { TaskManager } from './task-manager'
import { ETS_EVALUATE_RESOURCE_ID } from '@shared/constants'
import { choiceScore } from '@shared/scoring'

function attachment(question: Question, kind: AttachmentKind): QuestionAttachment | undefined {
  return question.attachments.find((item) => item.kind === kind)
}

function requireContext(question: Question, paper: Paper): UploadContext {
  const context: UploadContext = {
    homeworkId: question.uploadContext?.homeworkId || paper.homeworkId,
    resourceId:
      question.uploadContext?.resourceId || paper.resourceId || ETS_EVALUATE_RESOURCE_ID,
    setId: question.uploadContext?.setId || paper.setId || '',
    entityId: question.uploadContext?.entityId || '',
    order: question.uploadContext?.order || String(question.order),
    serialId: question.uploadContext?.serialId || '0',
    useTime: question.uploadContext?.useTime || 0,
    score: question.uploadContext?.score || '0.0',
    correct: question.uploadContext?.correct ?? 0,
    markTraceId: question.uploadContext?.markTraceId || ''
  }
  for (const key of ['homeworkId', 'resourceId', 'setId', 'entityId', 'order'] as const) {
    if (!context[key]) throw new Error(`上传上下文缺少 ${key}`)
  }
  return context
}

export class UploadService {
  constructor(
    private readonly api: EtsApiClient,
    private readonly papers: PaperService,
    private readonly audio: AudioService,
    private readonly oss: OssService,
    private readonly tasks: TaskManager
  ) {}

  validate(paperId: string, questionId: string): { ok: boolean; errors: string[] } {
    const paper = this.papers.getCached(paperId)
    const errors: string[] = []
    if (!paper) return { ok: false, errors: ['试卷缓存不存在，请重新打开作业'] }
    const question = findQuestion(paper, questionId)
    if (!question) return { ok: false, errors: ['题目不存在'] }
    if (question.structureType === 'collector.choose') {
      if (!question.selectedAnswer) errors.push('请先选择本题答案')
      try {
        requireContext(question, paper)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }
      return { ok: errors.length === 0, errors }
    }
    if (!attachment(question, 'audio')) errors.push('缺少 MP3/WAV 等音频附件')
    if (!attachment(question, 'xml')) errors.push('缺少 XML 评测附件')
    try {
      requireContext(question, paper)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
    return { ok: errors.length === 0, errors }
  }

  async submit(params: {
    session: AccountSession
    settings: AppSettings
    request: UploadRequest
  }): Promise<ReturnType<TaskManager['create']>> {
    const paper = this.papers.getCached(params.request.paperId)
    if (!paper) throw new Error('试卷缓存不存在，请重新打开作业')
    const question = findQuestion(paper, params.request.questionId)
    if (!question) throw new Error('题目不存在')
    const validation = this.validate(paper.id, question.id)
    if (!validation.ok) throw new Error(validation.errors.join('；'))
    if (!params.settings.dryRun && !params.request.confirmRealSubmit) {
      throw new Error('实际提交需要二次确认')
    }

    if (question.structureType === 'collector.choose') {
      return this.submitChoice({ ...params, paper, question })
    }

    const task = this.tasks.create(
      'oss-upload',
      `上传题目：${question.questionText || `第 ${question.order} 题`}`,
      {
        paperId: paper.id,
        questionId: question.id,
        confirmRealSubmit: params.request.confirmRealSubmit
      }
    )
    this.tasks.setStatus(task.id, 'running', '准备文件')

    try {
      const audio = attachment(question, 'audio')
      const xml = attachment(question, 'xml')
      if (!audio || !xml) throw new Error('附件不完整')

      this.tasks.update(task.id, { progress: 10, message: '转换 MP3 和 Speex' })
      const mp3Path = await this.audio.convertToMp3(params.settings.ffmpegPath, audio.localPath)
      const speexPath = await this.audio.convertToSpeex(params.settings.ffmpegPath, audio.localPath)
      if (!existsSync(mp3Path) || !existsSync(speexPath)) {
        throw new Error('音频转换结果不存在')
      }

      this.tasks.update(task.id, { progress: 30, message: '申请 OSS STS' })
      const config = await this.api.getOssUploadConfig(params.session.token)
      const userId = params.session.userId?.trim()
      if (!userId) {
        throw new Error('会话缺少 userId，无法生成 OSS 对象路径')
      }

      this.tasks.update(task.id, { progress: 45, message: '上传 MP3' })
      const mp3 = await this.oss.uploadFile({ config, kind: 'audio', userId, localPath: mp3Path })
      this.tasks.update(task.id, { progress: 62, message: '上传 Speex' })
      const speex = await this.oss.uploadFile({ config, kind: 'speex', userId, localPath: speexPath })
      this.tasks.update(task.id, { progress: 78, message: '上传 XML' })
      const xmlResult = await this.oss.uploadFile({
        config,
        kind: 'xml',
        userId,
        localPath: xml.localPath
      })

      const score = normalizeInternalScore(
        question.scoreOverride ??
          parseScoreXml(
            await (await import('node:fs/promises')).readFile(xml.localPath, 'utf8'),
            question.structureType
          )
      )
      const context = requireContext(question, paper)

      if (params.settings.dryRun) {
        this.tasks.update(task.id, {
          status: 'succeeded',
          progress: 100,
          message: '演练完成，已上传 OSS，未调用 sync-v2',
          finishedAt: Date.now()
        })
        this.updateQuestionState(paper, question.id, {
          status: 'ready',
          taskId: task.id,
          message: '已准备，未同步',
          mp3Url: mp3.url,
          speexUrl: speex.url,
          xmlUrl: xmlResult.url,
          updatedAt: Date.now()
        })
        return task
      }

      this.tasks.update(task.id, { progress: 90, message: '调用 m/audio/sync-v2' })
      await this.api.submitAudioSync({
        token: params.session.token,
        context,
        score: score.totalScore,
        scoreDetail: scoreDataToJson(score),
        mp3Url: mp3.url,
        speexUrl: speex.url,
        xmlUrl: xmlResult.url
      })
      this.tasks.update(task.id, {
        status: 'succeeded',
        progress: 100,
        message: '实际提交成功',
        finishedAt: Date.now()
      })
      this.updateQuestionState(paper, question.id, {
        status: 'submitted',
        taskId: task.id,
        message: '已提交',
        mp3Url: mp3.url,
        speexUrl: speex.url,
        xmlUrl: xmlResult.url,
        updatedAt: Date.now()
      })
      return task
    } catch (error) {
      this.tasks.update(task.id, {
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
        finishedAt: Date.now()
      })
      this.updateQuestionState(paper, question.id, {
        status: 'failed',
        taskId: task.id,
        message: error instanceof Error ? error.message : String(error),
        updatedAt: Date.now()
      })
      throw error
    }
  }

  private async submitChoice(params: {
    session: AccountSession
    settings: AppSettings
    request: UploadRequest
    paper: Paper
    question: Question
  }): Promise<ReturnType<TaskManager['create']>> {
    const { session, settings, request, paper, question } = params
    const task = this.tasks.create(
      'sync-submit',
      `提交选择题：第 ${question.order} 题`,
      {
        paperId: paper.id,
        questionId: question.id,
        confirmRealSubmit: request.confirmRealSubmit
      }
    )
    this.tasks.setStatus(task.id, 'running', '准备选择题同步数据')

    const selectedAnswer = question.selectedAnswer || ''
    const maxScore = question.maxScore ?? 1.5
    const totalScore = choiceScore(selectedAnswer, question.correctAnswer, maxScore)
    const scoreDetail: ScoreData = {
      totalScore: totalScore.toFixed(1),
      choose: selectedAnswer,
      fluencyScore: '0.0',
      accuracyScore: '0.0',
      integrityScore: '0.0',
      standardScore: '0.0',
      category: 'choose',
      repeatMode: '0',
      version: '7.0.71.2569(2569)',
      rateScale: 0,
      source: 'manual'
    }

    try {
      const context = requireContext(question, paper)
      if (settings.dryRun) {
        this.tasks.update(task.id, {
          status: 'succeeded',
          progress: 100,
          message: `演练完成：${selectedAnswer}，预计 ${totalScore.toFixed(1)} 分`,
          finishedAt: Date.now()
        })
        this.updateQuestionState(paper, question.id, {
          status: 'ready',
          taskId: task.id,
          message: '已准备，未同步',
          updatedAt: Date.now()
        })
        return task
      }

      this.tasks.update(task.id, { progress: 60, message: '调用 m/audio/sync-v2' })
      await this.api.submitChoiceSync({
        token: session.token,
        context,
        score: totalScore.toFixed(1),
        scoreDetail: scoreDataToJson(scoreDetail),
        correct: totalScore > 0 ? 1 : 0,
        choose: selectedAnswer
      })
      this.tasks.update(task.id, {
        status: 'succeeded',
        progress: 100,
        message: `选择题提交成功：${selectedAnswer}，${totalScore.toFixed(1)} 分`,
        finishedAt: Date.now()
      })
      this.updateQuestionState(paper, question.id, {
        status: 'submitted',
        taskId: task.id,
        message: `已提交：${selectedAnswer}`,
        updatedAt: Date.now()
      })
      return task
    } catch (error) {
      this.tasks.update(task.id, {
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
        finishedAt: Date.now()
      })
      this.updateQuestionState(paper, question.id, {
        status: 'failed',
        taskId: task.id,
        message: error instanceof Error ? error.message : String(error),
        updatedAt: Date.now()
      })
      throw error
    }
  }

  private updateQuestionState(
    paper: Paper,
    questionId: string,
    state: NonNullable<Question['uploadState']>
  ): void {
    this.papers.updateQuestion(paper.id, questionId, (question) => ({
      ...question,
      uploadState: state
    }))
  }
}

export function findQuestion(paper: Paper, questionId: string): Question | undefined {
  for (const section of paper.sections) {
    const found = section.questions.find((question) => question.id === questionId)
    if (found) return found
  }
  return undefined
}
