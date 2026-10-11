import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js'
import type {
  HomeworkInfo,
  Paper,
  PaperSection,
  Question
} from '@shared/types'
import { sha1 } from './crypto'
import { EtsApiClient } from './ets-api'
import { createEmptyPaper, parseContentJson } from './paper-parser'
import { TaskManager } from './task-manager'
import { generateZipPassword } from './zip-password'
import { logError, logInfo } from './logger'
import {
  ETS_EVALUATE_RESOURCE_ID,
  PAPER_CACHE_VERSION
} from '@shared/constants'

function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path.replace(/^http:/i, 'https:')
  const base = baseUrl.replace(/^http:/i, 'https:').replace(/\/+$/, '')
  return `${base}/${path.replace(/^\/+/, '')}`
}

export class PaperService {
  private readonly cacheDir = join(app.getPath('userData'), 'cache', 'papers')

  constructor(
    private readonly api: EtsApiClient,
    private readonly tasks: TaskManager
  ) {
    mkdirSync(this.cacheDir, { recursive: true })
  }

  getCached(paperId: string): Paper | null {
    const path = join(this.cacheDir, `${paperId}.json`)
    if (!existsSync(path)) return null
    try {
      const paper = JSON.parse(readFileSync(path, 'utf8')) as Paper
      if (paper.parserVersion !== PAPER_CACHE_VERSION) {
        logInfo('Paper', '旧试卷缓存已失效，将重新解析', {
          paperId,
          cachedVersion: paper.parserVersion,
          currentVersion: PAPER_CACHE_VERSION
        })
        return null
      }
      return paper
    } catch {
      return null
    }
  }

  save(paper: Paper): void {
    writeFileSync(join(this.cacheDir, `${paper.id}.json`), JSON.stringify(paper, null, 2), 'utf8')
  }

  updateQuestion(
    paperId: string,
    questionId: string,
    updater: (question: Question) => Question
  ): Paper {
    const paper = this.getCached(paperId)
    if (!paper) throw new Error('试卷缓存不存在')
    let found = false
    const next = {
      ...paper,
      sections: paper.sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => {
          if (question.id !== questionId) return question
          found = true
          return updater(question)
        })
      }))
    }
    if (!found) throw new Error('题目不存在')
    this.save(next)
    return next
  }

  async openHomework(homework: HomeworkInfo, baseUrl: string): Promise<Paper> {
    const emptyPaper = createEmptyPaper(homework.id, homework.name, baseUrl)
    const cached = this.getCached(emptyPaper.id)
    if (cached) return cached

    const task = this.tasks.create(
      'paper-download',
      `下载试卷：${homework.name}`,
      { homeworkId: homework.id }
    )
    logInfo('Paper', '开始打开作业', {
      taskId: task.id,
      homeworkId: homework.id,
      homeworkName: homework.name,
      baseUrl,
      contentCount: homework.contents.length
    })
    this.tasks.setStatus(task.id, 'running', '准备下载资源包')
    const sections: PaperSection[] = []
    const groupOffsets = new Map<string, number>()
    const setId = String(homework.raw?.set_id ?? '')

    try {
      for (let index = 0; index < homework.contents.length; index += 1) {
        const content = homework.contents[index]
        const url = joinUrl(baseUrl, content.url)
        logInfo('Paper', '准备下载资源包', {
          taskId: task.id,
          index,
          groupName: content.groupName,
          contentUrl: content.url,
          resolvedUrl: url
        })
        const message = `下载 ${index + 1}/${homework.contents.length}：${content.groupName}`
        this.tasks.update(task.id, {
          progress: Math.round((index / Math.max(homework.contents.length, 1)) * 100),
          message
        })
        this.tasks.appendLog(task.id, 'info', message, url)

        const zipPath = join(this.cacheDir, `${sha1(url)}.zip`)
        await this.api.downloadFile(url, zipPath, (downloaded, total) => {
          const inner = total > 0 ? downloaded / total : 0
          const overall = ((index + inner) / Math.max(homework.contents.length, 1)) * 100
          this.tasks.update(task.id, {
            progress: Math.round(overall),
            message
          })
        })

        const zipBytes = readFileSync(zipPath)
        logInfo('Paper', '资源包下载完成，开始解压', {
          taskId: task.id,
          zipPath,
          bytes: zipBytes.length,
          magic: zipBytes.subarray(0, 4).toString('hex')
        })
        const password = generateZipPassword(zipBytes)
        const reader = new ZipReader(
          new BlobReader(new Blob([new Uint8Array(zipBytes)])),
          { password }
        )
        const entries = await reader.getEntries()
        logInfo('Paper', 'ZIP 条目已读取', {
          taskId: task.id,
          fileCount: entries.length,
          files: entries.slice(0, 80).map((entry) => entry.filename)
        })
        const contentEntry =
          entries.find((entry) => entry.filename === 'content.json') ??
          entries.find((entry) => entry.filename.endsWith('/content.json'))
        if (!contentEntry) {
          await reader.close()
          throw new Error(
            `${content.groupName} 中缺少 content.json，ZIP 文件列表：` +
              entries.slice(0, 20).map((entry) => entry.filename).join(', ')
          )
        }
        if (!('getData' in contentEntry)) {
          await reader.close()
          throw new Error(`${content.groupName} 的 content.json 不是可读取文件`)
        }
        const contentBlob = await contentEntry.getData(new BlobWriter(), { password })
        await reader.close()
        if (!contentBlob) throw new Error(`${content.groupName} 无法读取 content.json`)

        const jsonText = await contentBlob.text()
        const offset = groupOffsets.get(content.groupName) ?? 0
        const section = parseContentJson(jsonText, homework.id, content.url, content.groupName, {
          setId,
          resourceId: ETS_EVALUATE_RESOURCE_ID,
          orderOffset: offset
        })
        sections.push(section)
        groupOffsets.set(content.groupName, offset + section.questions.length)
      }

      const paper: Paper = {
        ...emptyPaper,
        setId,
        resourceId: ETS_EVALUATE_RESOURCE_ID,
        parserVersion: PAPER_CACHE_VERSION,
        sections,
        createdAt: Date.now()
      }
      this.save(paper)
      this.tasks.update(task.id, {
        status: 'succeeded',
        progress: 100,
        message: `解析完成，共 ${sections.reduce((sum, section) => sum + section.questions.length, 0)} 道题`,
        finishedAt: Date.now()
      })
      return paper
    } catch (error) {
      logError('Paper', '打开作业失败', {
        taskId: task.id,
        homeworkId: homework.id,
        homeworkName: homework.name,
        error
      })
      this.tasks.update(task.id, {
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
        finishedAt: Date.now()
      })
      throw error
    }
  }
}
