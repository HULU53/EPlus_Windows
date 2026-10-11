/// <reference types="vite/client" />

import type { EtsApiBridge } from '../../shared/types'

declare global {
  interface Window {
    etsApi: EtsApiBridge
    etsLoginBridge?: {
      capture(payload: { url: string; status: number; responseBody: string }): void
    }
  }
}

export {}
