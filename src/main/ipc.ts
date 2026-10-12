import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { IPC } from '@shared/constants'
import type {
  AccountSession,
  AppSettings,
  AttachmentRequest,
  HomeworkInfo,
  HomeworkStatus,
  ImportTokenRequest,
  PasswordLoginRequest,
  Question,
  ScoreData,
  TaskEvent,
  UploadContext,
  UploadRequest
} from '@shared/types'
import { AuthService, selectValidAccount } from './services/auth-service'
import { AttachmentService } from './services/attachment-service'
import { AudioService } from './services/audio-service'
import { EtsApiClient } from './services/ets-api'
import { PaperService } from './services/paper-service'
import { SettingsService } from './services/settings-service'
import { TaskManager } from './services/task-manager'
import { findQuestion, UploadService } from './services/upload-service'
import { generateFullScoreXml } from './services/xml-preset'
import {
  configureLogger,
  getLogFilePath,
  logDebug,
  logError,
  logInfo
} from './services/logger'

export interface IpcContext {
  api: EtsApiClient
  auth: AuthService
  attachments: AttachmentService
  audio: AudioService
  papers: PaperService
  settings: SettingsService
  tasks: TaskManager
  uploads: UploadService
}

function requireSession(auth: AuthService): AccountSession {
  const session = auth.getSession()
  if (!session) throw new Error('尚未登录')
  return session
}

function broadcastTasks(tasks: TaskManager): void {
  const listener = (event: TaskEvent) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC.tasksEvent, event)
    }
  }
  tasks.onEvent(listener)
}

function customInternalScore(
  question: Question,
  retellExternal: number,
  readingExternal: number
): number {
  const part = question.partName || question.typeName || ''
  if (/听后回答/.test(part) || question.structureType === 'collector.role') {
    return 5 / 12
  }
  if (/听后转述/.test(part) || question.structureType === 'collector.picture') {
    return retellExternal / 2
  }
  if (/短文朗读/.test(part) || question.structureType === 'collector.read') {
    return (readingExternal * 5) / 9
  }
  return 5
}

export function registerIpc(context: IpcContext): void {
  broadcastTasks(context.tasks)
  const handle = <T extends unknown[]>(
    channel: string,
    handler: (event: Electron.IpcMainInvokeEvent, ...args: T) => unknown
  ) => {
    ipcMain.handle(channel, async (event, ...args: T) => {
      logDebug('IPC', `调用 ${channel}`, args)
      try {
        const result = await handler(event, ...args)
        logDebug('IPC', `完成 ${channel}`)
        return result
      } catch (error) {
        logError('IPC', `失败 ${channel}`, error)
        throw error
      }
    })
  }
  const listHomework = async (status: HomeworkStatus) => {
    let session = requireSession(context.auth)
    if (!session.parentAccountId) {
      const accounts = await context.api.getEcardList(session.token, session.protocolMode)
      const selected = selectValidAccount(accounts)
      if (!selected) throw new Error('账号下没有可用电子卡')
      session = context.auth.updateSession({
        parentAccountId: selected.parentId,
        displayName: selected.name || selected.grade,
        classId: selected.classId
      })
    }
    const parentAccountId = session.parentAccountId
    if (!parentAccountId) throw new Error('未能确定 parent_account_id')
    try {
      return await context.api.getHomeworkList(
        session.token,
        parentAccountId,
        status,
        session.protocolMode
      )
    } catch (error) {
      if (session.loginSource === 'password' && session.storedPassword) {
        logInfo('IPC', 'Token 请求失败，使用已保存密码重新登录')
        const refreshed = await context.auth.reauthenticate()
        if (!refreshed.parentAccountId) throw error
        return context.api.getHomeworkList(
          refreshed.token,
          refreshed.parentAccountId,
          status,
          refreshed.protocolMode
        )
      }
      throw error
    }
  }

  handle(IPC.authStartWebLogin, async () => context.auth.startWebLogin())
  handle(IPC.authLoginPassword, (_event, request: PasswordLoginRequest) =>
    context.auth.loginPassword(request)
  )
  handle(IPC.authImportToken, (_event, request: ImportTokenRequest) =>
    context.auth.importToken(request)
  )
  handle(IPC.authGetStatus, () => context.auth.getSession())
  handle(IPC.authLogout, () => {
    context.auth.logout()
  })

  handle(IPC.homeworkRefresh, (_event, status: HomeworkStatus) =>
    listHomework(status)
  )
  handle(IPC.homeworkList, (_event, status: HomeworkStatus) =>
    listHomework(status)
  )
  handle(IPC.rankingGet, (_event, homeworkId: string) => {
    const session = requireSession(context.auth)
    return context.api.getHomeworkRanking(session.token, homeworkId)
  })
  handle(
    IPC.homeworkOpen,
    async (_event, homework: HomeworkInfo, baseUrl: string) =>
      context.papers.openHomework(homework, baseUrl)
  )

  handle(IPC.paperAttachFile, (_event, request: AttachmentRequest) => {
    return attach(context, request, 'file')
  })
  handle(IPC.paperAttachRecording, (_event, request: AttachmentRequest) => {
    return attach(context, request, 'recording')
  })
  handle(
    IPC.paperRemoveAttachment,
    (_event, paperId: string, questionId: string, attachmentId: string) => {
      const paper = context.papers.getCached(paperId)
      if (!paper) throw new Error('试卷缓存不存在')
      const section = paper.sections.find((item) =>
        item.questions.some((question) => question.id === questionId)
      )
      const question = section?.questions.find((item) => item.id === questionId)
      const target = question?.attachments.find((item) => item.id === attachmentId)
      if (target) context.attachments.remove(target)
      context.papers.updateQuestion(paperId, questionId, (item) => ({
        ...item,
        attachments: item.attachments.filter((attachment) => attachment.id !== attachmentId)
      }))
    }
  )
  handle(
    IPC.paperSetScoreOverride,
    (_event, paperId: string, questionId: string, score?: ScoreData) => {
      context.papers.updateQuestion(paperId, questionId, (question) => ({
        ...question,
        scoreOverride: score
      }))
    }
  )
  handle(
    IPC.paperSetUploadContext,
    (_event, paperId: string, questionId: string, uploadContext: UploadContext) => {
      context.papers.updateQuestion(paperId, questionId, (question) => ({
        ...question,
        uploadContext
      }))
    }
  )
  handle(
    IPC.paperSetChoiceAnswer,
    (_event, paperId: string, questionId: string, answer: string) => {
      context.papers.updateQuestion(paperId, questionId, (question) => ({
        ...question,
        selectedAnswer: answer
      }))
      logInfo('Paper', '保存选择答案', { paperId, questionId, answer })
    }
  )
  handle(
    IPC.paperGenerateFullScoreXml,
    (_event, paperId: string, questionId: string) => {
      const paper = context.papers.getCached(paperId)
      if (!paper) throw new Error('试卷缓存不存在')
      const question = findQuestion(paper, questionId)
      if (!question) throw new Error('题目不存在')

      const preset = generateFullScoreXml(question)
      const attachment = context.attachments.saveBuffer({
        kind: 'xml',
        fileName: preset.fileName,
        mimeType: 'application/xml',
        bytes: Buffer.from(preset.xml, 'utf8'),
        source: 'generated'
      })

      const uploadContext: UploadContext = {
        homeworkId: question.uploadContext?.homeworkId || paper.homeworkId,
        resourceId:
          question.uploadContext?.resourceId || paper.resourceId || '55',
        setId: question.uploadContext?.setId || paper.setId || '',
        entityId: question.uploadContext?.entityId || '',
        order: question.uploadContext?.order || String(question.order),
        serialId: question.uploadContext?.serialId || '0',
        useTime: question.uploadContext?.useTime || 0,
        score: preset.score.totalScore,
        correct: question.uploadContext?.correct ?? 0,
        markTraceId: question.uploadContext?.markTraceId || ''
      }

      context.papers.updateQuestion(paperId, questionId, (current) => {
        for (const item of current.attachments) {
          if (item.kind === 'xml') context.attachments.remove(item)
        }
        return {
          ...current,
          attachments: [
            ...current.attachments.filter((item) => item.kind !== 'xml'),
            attachment
          ],
          scoreOverride: preset.score,
          uploadContext,
          uploadState: undefined
        }
      })
      logInfo('XMLPreset', '已生成满分 XML', {
        paperId,
        questionId,
        category: preset.category,
        bytes: Buffer.byteLength(preset.xml)
      })
      return {
        attachment,
        score: preset.score,
        uploadContext
      }
    }
  )
  handle(IPC.paperApplyFullScoreTemplate, async (_event, paperId: string) => {
    const paper = context.papers.getCached(paperId)
    if (!paper) throw new Error('试卷缓存不存在')
    const ffmpegPath = context.settings.get().ffmpegPath
    const silentPath = await context.audio.generateSilentMp3(ffmpegPath)
    let templated = 0
    let skipped = 0
    let choiceAnswered = 0

    for (const section of paper.sections) {
      for (const question of section.questions) {
        if (question.structureType === 'collector.choose') {
          if (question.correctAnswer) {
            context.papers.updateQuestion(paperId, question.id, (current) => ({
              ...current,
              selectedAnswer: current.correctAnswer
            }))
            choiceAnswered += 1
          }
          skipped += 1
          continue
        }
        const preset = generateFullScoreXml(question)
        const xmlAttachment = context.attachments.saveBuffer({
          kind: 'xml',
          fileName: preset.fileName,
          mimeType: 'application/xml',
          bytes: Buffer.from(preset.xml, 'utf8'),
          source: 'generated'
        })
        const audioAttachment = context.attachments.saveExistingFile({
          kind: 'audio',
          fileName: 'silence-1s.mp3',
          mimeType: 'audio/mpeg',
          sourcePath: silentPath,
          source: 'generated'
        })
        context.papers.updateQuestion(paperId, question.id, (current) => {
          for (const item of current.attachments) {
            if (item.kind === 'audio' || item.kind === 'xml') {
              context.attachments.remove(item)
            }
          }
          return {
            ...current,
            attachments: [audioAttachment, xmlAttachment],
            scoreOverride: preset.score,
            uploadContext: {
              homeworkId: current.uploadContext?.homeworkId || paper.homeworkId,
              resourceId:
                current.uploadContext?.resourceId || paper.resourceId || '55',
              setId: current.uploadContext?.setId || paper.setId || '',
              entityId: current.uploadContext?.entityId || '',
              order: current.uploadContext?.order || String(current.order),
              serialId: current.uploadContext?.serialId || '0',
              useTime: current.uploadContext?.useTime || 0,
              correct: current.uploadContext?.correct ?? 0,
              markTraceId: current.uploadContext?.markTraceId || '',
              score: preset.score.totalScore
            },
            uploadState: undefined
          }
        })
        templated += 1
      }
    }
    logInfo('Paper', '一键满分模板完成', {
      paperId,
      templated,
      skipped
    })
    return {
      paper: context.papers.getCached(paperId),
      templated,
      skipped,
      choiceAnswered
    }
  })
  handle(
    IPC.paperApplyCustomScoreTemplate,
    async (_event, paperId: string, totalScore: number) => {
      const settings = context.settings.get()
      if (!settings.experimentalCustomScoreEnabled) {
        throw new Error('请先在设置中开启实验性自定义得分')
      }
      if (
        !Number.isInteger(totalScore) ||
        totalScore < 15 ||
        totalScore > 2_147_483_647
      ) {
        throw new Error('自定义总分必须是 15 到 2147483647 之间的整数')
      }
      const paper = context.papers.getCached(paperId)
      if (!paper) throw new Error('试卷缓存不存在')

      const retellExternal = (totalScore - 15) / 2
      const readingExternal = (totalScore - 15) / 2
      const ffmpegPath = settings.ffmpegPath
      const silentPath = await context.audio.generateSilentMp3(ffmpegPath)
      let templated = 0
      let skipped = 0
      let choiceAnswered = 0

      for (const section of paper.sections) {
        for (const question of section.questions) {
          if (question.structureType === 'collector.choose') {
            if (question.correctAnswer) {
              context.papers.updateQuestion(paperId, question.id, (current) => ({
                ...current,
                selectedAnswer: current.correctAnswer
              }))
              choiceAnswered += 1
            }
            skipped += 1
            continue
          }

          const internalScore = customInternalScore(
            question,
            retellExternal,
            readingExternal
          )
          const preset = generateFullScoreXml(question, internalScore, true)
          const xmlAttachment = context.attachments.saveBuffer({
            kind: 'xml',
            fileName: `custom-score-${preset.category}.xml`,
            mimeType: 'application/xml',
            bytes: Buffer.from(preset.xml, 'utf8'),
            source: 'generated'
          })
          const audioAttachment = context.attachments.saveExistingFile({
            kind: 'audio',
            fileName: 'silence-1s.mp3',
            mimeType: 'audio/mpeg',
            sourcePath: silentPath,
            source: 'generated'
          })
          context.papers.updateQuestion(paperId, question.id, (current) => {
            for (const item of current.attachments) {
              if (item.kind === 'audio' || item.kind === 'xml') {
                context.attachments.remove(item)
              }
            }
            return {
              ...current,
              attachments: [audioAttachment, xmlAttachment],
              scoreOverride: preset.score,
              uploadContext: {
                homeworkId: current.uploadContext?.homeworkId || paper.homeworkId,
                resourceId:
                  current.uploadContext?.resourceId || paper.resourceId || '55',
                setId: current.uploadContext?.setId || paper.setId || '',
                entityId: current.uploadContext?.entityId || '',
                order: current.uploadContext?.order || String(current.order),
                serialId: current.uploadContext?.serialId || '0',
                useTime: current.uploadContext?.useTime || 0,
                correct: current.uploadContext?.correct ?? 0,
                markTraceId: current.uploadContext?.markTraceId || '',
                score: preset.score.totalScore
              },
              uploadState: undefined
            }
          })
          templated += 1
        }
      }
      logInfo('Paper', '自定义得分模板完成', {
        paperId,
        totalScore,
        retellExternal,
        readingExternal,
        templated,
        skipped
      })
      return {
        paper: context.papers.getCached(paperId),
        templated,
        skipped,
        choiceAnswered,
        listeningAnswerExternal: 6,
        retellExternal,
        readingExternal
      }
    }
  )
  handle(
    IPC.paperSubmitAll,
    async (_event, paperId: string, confirmRealSubmit: boolean) => {
      const paper = context.papers.getCached(paperId)
      if (!paper) throw new Error('试卷缓存不存在')
      const settings = context.settings.get()
      if (!settings.dryRun && !confirmRealSubmit) {
        throw new Error('实际提交需要二次确认')
      }
      const session = requireSession(context.auth)
      let submitted = 0
      let skipped = 0
      const failed: string[] = []

      for (const section of paper.sections) {
        for (const question of section.questions) {
          const isChoice = question.structureType === 'collector.choose'
          if (isChoice && !question.selectedAnswer) {
            skipped += 1
            continue
          }
          const hasAudio = question.attachments.some((item) => item.kind === 'audio')
          const hasXml = question.attachments.some((item) => item.kind === 'xml')
          if (!isChoice && (!hasAudio || !hasXml)) {
            skipped += 1
            continue
          }
          try {
            await context.uploads.submit({
              session,
              settings,
              request: {
                paperId,
                questionId: question.id,
                confirmRealSubmit
              }
            })
            submitted += 1
          } catch (error) {
            failed.push(
              `${question.partName || section.caption} 第${question.order}题：` +
                (error instanceof Error ? error.message : String(error))
            )
          }
        }
      }
      logInfo('Paper', '一键提交完成', {
        paperId,
        submitted,
        skipped,
        failedCount: failed.length
      })
      return {
        paper: context.papers.getCached(paperId),
        submitted,
        skipped,
        failed
      }
    }
  )

  handle(IPC.uploadValidate, (_event, request: UploadRequest) =>
    context.uploads.validate(request.paperId, request.questionId)
  )
  handle(IPC.uploadSubmit, (_event, request: UploadRequest) =>
    context.uploads.submit({
      session: requireSession(context.auth),
      settings: context.settings.get(),
      request
    })
  )
  handle(IPC.uploadRetry, async (_event, taskId: string) => {
    const task = context.tasks.get(taskId)
    if (!task?.payload?.paperId || !task.payload.questionId) {
      throw new Error('该任务不支持重试')
    }
    return context.uploads.submit({
      session: requireSession(context.auth),
      settings: context.settings.get(),
      request: {
        paperId: String(task.payload.paperId),
        questionId: String(task.payload.questionId),
        confirmRealSubmit: Boolean(task.payload.confirmRealSubmit)
      }
    })
  })

  handle(IPC.tasksList, () => context.tasks.list())
  handle(IPC.tasksCancel, (_event, taskId: string) => {
    context.tasks.setStatus(taskId, 'cancelled')
  })

  handle(IPC.settingsGet, () => context.settings.get())
  handle(IPC.settingsUpdate, (_event, patch: Partial<AppSettings>) => {
    const settings = context.settings.update(patch)
    configureLogger({
      enabled: settings.loggingEnabled,
      level: settings.logLevel
    })
    return settings
  })
  handle(IPC.diagnosticsExport, () => {
    const path = join(app.getPath('downloads'), `ets100-diagnostics-${Date.now()}.json`)
    const session = context.auth.getSession()
    writeFileSync(
      path,
      JSON.stringify(
        {
          appVersion: app.getVersion(),
          platform: process.platform,
          settings: context.settings.get(),
          session: session
            ? {
                id: session.id,
                userId: session.userId,
                loginSource: session.loginSource,
                protocolMode: session.protocolMode,
                tokenExpiresAt: session.tokenExpiresAt
              }
            : null,
          tasks: context.tasks.list()
        },
        null,
        2
      ),
      'utf8'
    )
    return path
  })
  handle(IPC.diagnosticsLogPath, () => getLogFilePath())
  handle(IPC.systemPickFfmpeg, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择 ffmpeg.exe',
      properties: ['openFile'],
      filters: [{ name: 'FFmpeg', extensions: ['exe'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })
  handle(IPC.systemOpenPath, async (_event, path: string) => {
    await shell.openPath(path)
  })

}

function attach(
  context: IpcContext,
  request: AttachmentRequest,
  source: 'file' | 'recording'
): ReturnType<AttachmentService['saveBuffer']> {
  const paper = context.papers.getCached(request.paperId)
  if (!paper) throw new Error('试卷缓存不存在')
  const attachment = context.attachments.saveBuffer({
    kind: request.kind,
    fileName: request.fileName,
    mimeType: request.mimeType,
    bytes: Buffer.from(request.bytes),
    source
  })
  context.papers.updateQuestion(request.paperId, request.questionId, (question) => {
    const old = question.attachments.filter((item) => item.kind !== request.kind)
    for (const item of question.attachments) {
      if (item.kind === request.kind) context.attachments.remove(item)
    }
    return {
      ...question,
      attachments: [...old, attachment]
    }
  })
  return attachment
}
