import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/constants'
import type {
  AppSettings,
  AttachmentRequest,
  EtsApiBridge,
  HomeworkInfo,
  HomeworkStatus,
  ImportTokenRequest,
  PasswordLoginRequest,
  ScoreData,
  TaskEvent,
  UploadContext,
  UploadRequest
} from '../shared/types'

const api: EtsApiBridge = {
  auth: {
    startWebLogin: () => ipcRenderer.invoke(IPC.authStartWebLogin),
    loginPassword: (request: PasswordLoginRequest) =>
      ipcRenderer.invoke(IPC.authLoginPassword, request),
    importToken: (request: ImportTokenRequest) =>
      ipcRenderer.invoke(IPC.authImportToken, request),
    getStatus: () => ipcRenderer.invoke(IPC.authGetStatus),
    logout: () => ipcRenderer.invoke(IPC.authLogout)
  },
  homework: {
    list: (status: HomeworkStatus) => ipcRenderer.invoke(IPC.homeworkList, status),
    open: (homework: HomeworkInfo, baseUrl: string) =>
      ipcRenderer.invoke(IPC.homeworkOpen, homework, baseUrl),
    refresh: (status: HomeworkStatus) => ipcRenderer.invoke(IPC.homeworkRefresh, status)
  },
  paper: {
    attachFile: (request: AttachmentRequest) =>
      ipcRenderer.invoke(IPC.paperAttachFile, request),
    attachRecording: (request: AttachmentRequest) =>
      ipcRenderer.invoke(IPC.paperAttachRecording, request),
    removeAttachment: (paperId: string, questionId: string, attachmentId: string) =>
      ipcRenderer.invoke(IPC.paperRemoveAttachment, paperId, questionId, attachmentId),
    setScoreOverride: (paperId: string, questionId: string, score?: ScoreData) =>
      ipcRenderer.invoke(IPC.paperSetScoreOverride, paperId, questionId, score),
    setUploadContext: (paperId: string, questionId: string, context: UploadContext) =>
      ipcRenderer.invoke(IPC.paperSetUploadContext, paperId, questionId, context),
    setChoiceAnswer: (paperId: string, questionId: string, answer: string) =>
      ipcRenderer.invoke(IPC.paperSetChoiceAnswer, paperId, questionId, answer),
    generateFullScoreXml: (paperId: string, questionId: string) =>
      ipcRenderer.invoke(IPC.paperGenerateFullScoreXml, paperId, questionId),
    applyFullScoreTemplate: (paperId: string) =>
      ipcRenderer.invoke(IPC.paperApplyFullScoreTemplate, paperId),
    applyCustomScoreTemplate: (paperId: string, totalScore: number) =>
      ipcRenderer.invoke(IPC.paperApplyCustomScoreTemplate, paperId, totalScore),
    submitAll: (paperId: string, confirmRealSubmit: boolean) =>
      ipcRenderer.invoke(IPC.paperSubmitAll, paperId, confirmRealSubmit)
  },
  upload: {
    validate: (request: UploadRequest) => ipcRenderer.invoke(IPC.uploadValidate, request),
    submit: (request: UploadRequest) => ipcRenderer.invoke(IPC.uploadSubmit, request),
    retry: (taskId: string) => ipcRenderer.invoke(IPC.uploadRetry, taskId)
  },
  tasks: {
    list: () => ipcRenderer.invoke(IPC.tasksList),
    cancel: (taskId: string) => ipcRenderer.invoke(IPC.tasksCancel, taskId),
    onEvent: (callback: (event: TaskEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: TaskEvent) => callback(payload)
      ipcRenderer.on(IPC.tasksEvent, listener)
      return () => ipcRenderer.removeListener(IPC.tasksEvent, listener)
    }
  },
  ranking: {
    get: (homeworkId: string) => ipcRenderer.invoke(IPC.rankingGet, homeworkId)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch: Partial<AppSettings>) => ipcRenderer.invoke(IPC.settingsUpdate, patch)
  },
  diagnostics: {
    export: () => ipcRenderer.invoke(IPC.diagnosticsExport),
    logPath: () => ipcRenderer.invoke(IPC.diagnosticsLogPath)
  },
  system: {
    pickFfmpeg: () => ipcRenderer.invoke(IPC.systemPickFfmpeg),
    openPath: (path: string) => ipcRenderer.invoke(IPC.systemOpenPath, path)
  }
}

contextBridge.exposeInMainWorld('etsApi', api)
