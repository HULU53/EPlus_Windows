export const API_BASE_URL = 'https://api.ets100.com'
export const CDN_BASE_URL = 'https://cdn.subject.ets100.com'
export const CHANGYAN_LOGIN_URL =
  'https://pass.changyan.com/login?nextpage=aHR0cHM6Ly93d3cuZXRzMTAwLmNvbS9sb2dpbkNoZWNrLmh0bWw=&customConfig=e2hpZGRlbl9tb2R1bGU6ICJoZWFkZXIsdGFpbCxsb2dpbkJ5VmVyaWZ5Q29kZSxyZWdpc3Rlcixsb2dpbkJ5VGhpcmRMb2dpbiIscHJvZHVjdF9hcHBrZXk6InFpbmdkYW9fZXRzIiwibmVlZFRpY2tldCI6InRydWUiLCJsb2dpbl9ub3RBdXRvIjoidHJ1ZSJ9&from=ew&appId=pass6port18'

export const ETS_PID = 'grlx'
export const ETS_SECRET_KEY = '555ffbe95ccf4e9535a110170b445ab8'
export const ETS_DEFAULT_SN = 'test'
export const ETS_DEFAULT_SYSTEM = '4'
export const ETS_DEFAULT_VERSION = '3'
export const ETS_DEFAULT_GLOBAL_CLIENT_VERSION = '5.4.5'
export const ETS_DEFAULT_DEVICE_NAME = 'DESKTOP'
export const ETS_DEFAULT_REBIND_VERSION = '2'
export const ETS_DEFAULT_REBIND_DEVICE_NAME = '1337'
export const ETS_DEFAULT_LOCAL_IP = '127.0.0.1'
export const ETS_EVALUATE_RESOURCE_ID = '55'
export const PAPER_CACHE_VERSION = 3
export const ETS_CAPTURED_APP_VERSION = '7.0.71.2569(2569)'
export const ETS_CAPTURED_SYSTEM = '2'

export const ZIP_FOOTER_SIZE = 336
export const ZIP_SEED_START = 16
export const ZIP_SEED_END = 143

export const IPC = {
  authStartWebLogin: 'auth:startWebLogin',
  authLoginPassword: 'auth:loginPassword',
  authImportToken: 'auth:importToken',
  authGetStatus: 'auth:getStatus',
  authLogout: 'auth:logout',
  homeworkList: 'homework:list',
  homeworkOpen: 'homework:open',
  homeworkRefresh: 'homework:refresh',
  paperAttachFile: 'paper:attachFile',
  paperAttachRecording: 'paper:attachRecording',
  paperRemoveAttachment: 'paper:removeAttachment',
  paperSetScoreOverride: 'paper:setScoreOverride',
  paperSetUploadContext: 'paper:setUploadContext',
  paperSetChoiceAnswer: 'paper:setChoiceAnswer',
  paperGenerateFullScoreXml: 'paper:generateFullScoreXml',
  paperApplyFullScoreTemplate: 'paper:applyFullScoreTemplate',
  paperSubmitAll: 'paper:submitAll',
  uploadValidate: 'upload:validate',
  uploadSubmit: 'upload:submit',
  uploadRetry: 'upload:retry',
  tasksList: 'tasks:list',
  tasksCancel: 'tasks:cancel',
  tasksEvent: 'tasks:event',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  diagnosticsExport: 'diagnostics:export',
  diagnosticsLogPath: 'diagnostics:logPath',
  systemPickFfmpeg: 'system:pickFfmpeg',
  systemOpenPath: 'system:openPath'
} as const

