import { create } from 'zustand'
import type {
  AccountSession,
  AppSettings,
  HomeworkInfo,
  HomeworkListResult,
  HomeworkStatus,
  Paper,
  TaskEvent,
  TaskJob
} from '../../shared/types'

export type Page = 'overview' | 'account' | 'homework' | 'tasks' | 'settings'

interface AppState {
  ready: boolean
  page: Page
  session: AccountSession | null
  settings: AppSettings | null
  homeworkStatus: HomeworkStatus
  homeworkResult: HomeworkListResult | null
  selectedHomework: HomeworkInfo | null
  paper: Paper | null
  tasks: TaskJob[]
  loading: boolean
  error: string | null
  setPage(page: Page): void
  bootstrap(): Promise<void>
  refreshSession(): Promise<void>
  startWebLogin(): Promise<void>
  loginPassword(phone: string, password: string, rememberPassword: boolean): Promise<void>
  importToken(token: string): Promise<void>
  logout(): Promise<void>
  loadHomeworks(status?: HomeworkStatus): Promise<void>
  openHomework(homework: HomeworkInfo): Promise<void>
  closePaper(): void
  refreshTasks(): Promise<void>
  applyTaskEvent(event: TaskEvent): void
  saveSettings(patch: Partial<AppSettings>): Promise<void>
  setError(error: string | null): void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  page: 'overview',
  session: null,
  settings: null,
  homeworkStatus: '1',
  homeworkResult: null,
  selectedHomework: null,
  paper: null,
  tasks: [],
  loading: false,
  error: null,

  setPage: (page) => set({ page }),
  setError: (error) => set({ error }),

  async bootstrap() {
    try {
      const [session, settings, tasks] = await Promise.all([
        window.etsApi.auth.getStatus(),
        window.etsApi.settings.get(),
        window.etsApi.tasks.list()
      ])
      set({ ready: true, session, settings, tasks })
      window.etsApi.tasks.onEvent((event) => get().applyTaskEvent(event))
    } catch (error) {
      set({ ready: true, error: errorMessage(error) })
    }
  },

  async refreshSession() {
    const session = await window.etsApi.auth.getStatus()
    set({ session })
  },

  async startWebLogin() {
    set({ loading: true, error: null })
    try {
      const session = await window.etsApi.auth.startWebLogin()
      set({ session, page: 'overview' })
    } catch (error) {
      set({ error: errorMessage(error) })
    } finally {
      set({ loading: false })
    }
  },

  async loginPassword(phone, password, rememberPassword) {
    set({ loading: true, error: null })
    try {
      const session = await window.etsApi.auth.loginPassword({
        phone,
        password,
        rememberPassword
      })
      set({ session, page: 'overview' })
      await get().loadHomeworks()
    } catch (error) {
      set({ error: errorMessage(error) })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  async importToken(token) {
    set({ loading: true, error: null })
    try {
      const session = await window.etsApi.auth.importToken({ token })
      set({ session, page: 'account' })
    } catch (error) {
      set({ error: errorMessage(error) })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  async logout() {
    await window.etsApi.auth.logout()
    set({
      session: null,
      homeworkResult: null,
      selectedHomework: null,
      paper: null,
      page: 'account'
    })
  },

  async loadHomeworks(status) {
    const nextStatus = status ?? get().homeworkStatus
    set({ loading: true, error: null, homeworkStatus: nextStatus })
    try {
      const result = await window.etsApi.homework.refresh(nextStatus)
      set({ homeworkResult: result })
    } catch (error) {
      set({ error: errorMessage(error) })
    } finally {
      set({ loading: false })
    }
  },

  async openHomework(homework) {
    const result = get().homeworkResult
    if (!result) return
    set({ loading: true, error: null, selectedHomework: homework })
    try {
      const paper = await window.etsApi.homework.open(homework, result.baseUrl)
      set({ paper, page: 'homework' })
    } catch (error) {
      set({ error: errorMessage(error) })
    } finally {
      set({ loading: false })
    }
  },

  closePaper() {
    set({ paper: null, selectedHomework: null })
  },

  async refreshTasks() {
    set({ tasks: await window.etsApi.tasks.list() })
  },

  applyTaskEvent(event) {
    const current = get().tasks
    if (event.type === 'created' && event.task) {
      set({ tasks: [event.task, ...current.filter((task) => task.id !== event.task!.id)] })
    } else if (event.type === 'updated' && event.task) {
      set({
        tasks: current.map((task) => (task.id === event.task!.id ? event.task! : task))
      })
    } else if (event.type === 'removed' && event.taskId) {
      set({ tasks: current.filter((task) => task.id !== event.taskId) })
    }
  },

  async saveSettings(patch) {
    const settings = await window.etsApi.settings.update(patch)
    set({ settings })
  }
}))
