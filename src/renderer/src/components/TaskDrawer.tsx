import { useState } from 'react'
import { CheckCircle2, ChevronRight, CircleAlert, LoaderCircle, X } from 'lucide-react'
import { useAppStore } from '../store'
import type { TaskJob } from '../../../shared/types'

function TaskIcon({ task }: { task: TaskJob }) {
  if (task.status === 'succeeded') return <CheckCircle2 size={15} className="text-emerald-500" />
  if (task.status === 'failed') return <CircleAlert size={15} className="text-red-500" />
  return <LoaderCircle size={15} className="animate-spin text-[#0f8f7a]" />
}

export function TaskDrawer() {
  const [open, setOpen] = useState(false)
  const tasks = useAppStore((state) => state.tasks)
  const active = tasks.filter((task) =>
    ['queued', 'running', 'waiting-auth', 'waiting-confirmation'].includes(task.status)
  ).length

  return (
    <div className="relative z-30">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="absolute right-4 top-[72px] flex items-center gap-2 rounded-lg border hairline bg-[canvas] px-3 py-2 text-xs shadow-lg transition hover:-translate-y-0.5"
      >
        {active > 0 ? <LoaderCircle size={15} className="animate-spin text-[#0f8f7a]" /> : <CheckCircle2 size={15} />}
        任务
        {active > 0 && (
          <span className="rounded-full bg-[#0f8f7a] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {active}
          </span>
        )}
      </button>

      {open && (
        <aside className="absolute right-4 top-[118px] max-h-[calc(100vh-140px)] w-[360px] overflow-hidden rounded-lg border hairline bg-[canvas] shadow-2xl">
          <div className="flex items-center justify-between border-b hairline px-4 py-3">
            <div>
              <div className="text-sm font-semibold">任务进度</div>
              <div className="text-[11px] muted">下载、转码、上传与同步</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-7 w-7 place-items-center rounded-md hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X size={15} />
            </button>
          </div>
          <div className="max-h-[520px] overflow-auto p-3">
            {tasks.length === 0 ? (
              <div className="grid h-28 place-items-center text-xs muted">暂无任务</div>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 30).map((task) => (
                  <div key={task.id} className="rounded-lg border hairline p-3">
                    <div className="flex items-start gap-2">
                      <TaskIcon task={task} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">{task.title}</div>
                        <div className="mt-1 text-[11px] muted">{task.message}</div>
                      </div>
                      <span className="text-[10px] muted">{task.progress}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#0f8f7a] transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    {task.status === 'failed' && task.retryable && (
                      <button
                        type="button"
                        className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#0f8f7a]"
                        onClick={() => void window.etsApi.upload.retry(task.id)}
                      >
                        重试 <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
