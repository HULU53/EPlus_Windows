import { useEffect } from 'react'
import { AppShell } from './components/AppShell'
import { useAppStore } from './store'

export function App() {
  const ready = useAppStore((state) => state.ready)
  const settings = useAppStore((state) => state.settings)
  const bootstrap = useAppStore((state) => state.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    const theme = settings?.theme ?? 'system'
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.dataset.theme = theme
    }
  }, [settings?.theme])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-sm muted">
        正在初始化工作区...
      </div>
    )
  }

  return <AppShell />
}
