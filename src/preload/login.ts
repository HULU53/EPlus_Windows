import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('etsLoginBridge', {
  capture(payload: { url: string; status: number; responseBody: string }) {
    ipcRenderer.send('login:capture', payload)
  }
})
