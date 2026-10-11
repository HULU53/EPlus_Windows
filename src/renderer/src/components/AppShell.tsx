import {
  Activity,
  BookOpen,
  ChevronRight,
  CircleUserRound,
  CloudDownload,
  FileText,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound
} from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { useAppStore, type Page } from '../store'
import { AccountPage } from '../pages/AccountPage'
import { HomeworkPage } from '../pages/HomeworkPage'
import { OverviewPage } from '../pages/OverviewPage'
import { PaperPage } from '../pages/PaperPage'
import { SettingsPage } from '../pages/SettingsPage'
import { TasksPage } from '../pages/TasksPage'
import { TaskDrawer } from './TaskDrawer'

const NAV: Array<{ page: Page; label: string; icon: ReactNode }> = [
  { page: 'overview', label: '总览', icon: <Activity size={18} /> },
  { page: 'account', label: '账号', icon: <UserRound size={18} /> },
  { page: 'homework', label: '作业', icon: <BookOpen size={18} /> },
  { page: 'tasks', label: '任务', icon: <CloudDownload size={18} /> },
  { page: 'settings', label: '设置', icon: <Settings size={18} /> }
]

export function AppShell() {
  const page = useAppStore((state) => state.page)
  const setPage = useAppStore((state) => state.setPage)
  const session = useAppStore((state) => state.session)
  const paper = useAppStore((state) => state.paper)
  const settings = useAppStore((state) => state.settings)
  const error = useAppStore((state) => state.error)
  const setError = useAppStore((state) => state.setError)
  const logout = useAppStore((state) => state.logout)

  const content =
    paper ? (
      <PaperPage />
    ) : page === 'overview' ? (
      <OverviewPage />
    ) : page === 'account' ? (
      <AccountPage />
    ) : page === 'homework' ? (
      <HomeworkPage />
    ) : page === 'tasks' ? (
      <TasksPage />
    ) : (
      <SettingsPage />
    )

  return (
    <div className="app-surface flex h-full">
      <aside className="flex w-[76px] shrink-0 flex-col border-r hairline bg-black/[0.015] px-2 py-3 dark:bg-white/[0.015]">
        <div className="mb-4 flex h-11 items-center justify-center">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#0f8f7a] text-sm font-black text-white shadow-sm">
            E
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Tooltip.Root key={item.page}>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    useAppStore.getState().closePaper()
                    setPage(item.page)
                  }}
                  className={[
                    'grid h-11 place-items-center rounded-lg transition',
                    page === item.page && !paper
                      ? 'bg-[#0f8f7a] text-white shadow-sm'
                      : 'muted hover:bg-black/5 hover:text-current dark:hover:bg-white/5'
                  ].join(' ')}
                  aria-label={item.label}
                >
                  {item.icon}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="right"
                  sideOffset={8}
                  className="z-50 rounded-md border hairline bg-[canvas] px-2 py-1 text-xs shadow-xl"
                >
                  {item.label}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </nav>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              className="grid h-11 place-items-center rounded-lg muted hover:bg-red-500/10 hover:text-red-500"
              onClick={() => void logout()}
              aria-label="退出登录"
            >
              <LogOut size={18} />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              sideOffset={8}
              className="z-50 rounded-md border hairline bg-[canvas] px-2 py-1 text-xs shadow-xl"
            >
              退出登录
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[58px] shrink-0 items-center justify-between border-b hairline px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="text-[13px] font-semibold tracking-tight">ETS100 Desk</div>
            <ChevronRight size={14} className="muted" />
            <div className="truncate text-xs muted">
              {paper ? `试卷 · ${paper.title}` : NAV.find((item) => item.page === page)?.label}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {settings && (
              <span
                className={[
                  'rounded-md border px-2 py-1 text-[11px] font-semibold',
                  settings.dryRun
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                ].join(' ')}
              >
                {settings.dryRun ? '演练模式' : '实际提交'}
              </span>
            )}
            <div className="flex items-center gap-2 rounded-lg border hairline px-3 py-1.5">
              <CircleUserRound size={17} className="text-[#0f8f7a]" />
              <div className="max-w-[220px] leading-tight">
                <div className="truncate text-xs font-semibold">
                  {session?.displayName || (session ? 'ETS100 账号' : '未登录')}
                </div>
                <div className="truncate text-[10px] muted">
                  {session?.tokenExpiresAt
                    ? `Token 至 ${new Date(session.tokenExpiresAt * 1000).toLocaleDateString()}`
                    : session
                      ? '导入 Token'
                      : '等待登录'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mx-5 mt-3 flex items-start justify-between rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            <div className="flex items-start gap-2">
              <ShieldCheck size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)} className="font-bold">
              关闭
            </button>
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-hidden">{content}</main>
      </div>

      <TaskDrawer />
    </div>
  )
}
