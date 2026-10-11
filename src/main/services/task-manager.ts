import { EventEmitter } from 'node:events'
import { app } from 'electron'
import { join } from 'node:path'
import type { TaskEvent, TaskJob, TaskKind, TaskLog, TaskStatus } from '@shared/types'
import { JsonStore } from './json-store'
import { randomId } from './crypto'

export class TaskManager {
  private readonly events = new EventEmitter()
  private readonly store = new JsonStore<TaskJob[]>(
    join(app.getPath('userData'), 'tasks.json'),
    []
  )

  list(): TaskJob[] {
    return this.store.read().sort((a, b) => b.createdAt - a.createdAt)
  }

  get(id: string): TaskJob | undefined {
    return this.store.read().find((task) => task.id === id)
  }

  create(kind: TaskKind, title: string, payload?: Record<string, unknown>): TaskJob {
    const now = Date.now()
    const task: TaskJob = {
      id: randomId(),
      kind,
      title,
      status: 'queued',
      progress: 0,
      message: '等待执行',
      createdAt: now,
      retryable: false,
      payload,
      logs: []
    }
    this.store.update((tasks) => [task, ...tasks].slice(0, 1000))
    this.emit({ type: 'created', task })
    return task
  }

  update(
    id: string,
    patch: Partial<Pick<TaskJob, 'status' | 'progress' | 'message' | 'retryable' | 'startedAt' | 'finishedAt' | 'payload'>>
  ): TaskJob {
    let updated: TaskJob | undefined
    this.store.update((tasks) =>
      tasks.map((task) => {
        if (task.id !== id) return task
        updated = { ...task, ...patch }
        return updated
      })
    )
    if (!updated) throw new Error(`任务不存在: ${id}`)
    this.emit({ type: 'updated', task: updated })
    return updated
  }

  appendLog(id: string, level: TaskLog['level'], message: string, details?: string): void {
    let updated: TaskJob | undefined
    this.store.update((tasks) =>
      tasks.map((task) => {
        if (task.id !== id) return task
        const log: TaskLog = { at: Date.now(), level, message, details }
        updated = { ...task, logs: [...task.logs, log].slice(-500) }
        return updated
      })
    )
    if (updated) this.emit({ type: 'updated', task: updated })
  }

  setStatus(id: string, status: TaskStatus, message?: string): TaskJob {
    const now = Date.now()
    return this.update(id, {
      status,
      message: message ?? this.defaultMessage(status),
      startedAt: status === 'running' ? now : undefined,
      finishedAt: ['succeeded', 'failed', 'cancelled'].includes(status) ? now : undefined
    })
  }

  onEvent(listener: (event: TaskEvent) => void): () => void {
    this.events.on('event', listener)
    return () => this.events.off('event', listener)
  }

  private emit(event: TaskEvent): void {
    this.events.emit('event', event)
  }

  private defaultMessage(status: TaskStatus): string {
    const messages: Record<TaskStatus, string> = {
      queued: '等待执行',
      running: '正在执行',
      'waiting-auth': '等待重新登录',
      'waiting-confirmation': '等待用户确认',
      succeeded: '执行成功',
      failed: '执行失败',
      cancelled: '已取消'
    }
    return messages[status]
  }
}
