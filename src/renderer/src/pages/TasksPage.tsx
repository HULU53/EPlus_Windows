import { CheckCircle2, CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react'
import { useAppStore } from '../store'
import type { TaskJob } from '../../../shared/types'

function TaskStatus({ task }: { task: TaskJob }) {
  if (task.status === 'succeeded') return <CheckCircle2 size={16} className="text-emerald-500" />
  if (task.status === 'failed' || task.status === 'cancelled')
    return <CircleAlert size={16} className="text-red-500" />
  return <LoaderCircle size={16} className="animate-spin text-[#0f8f7a]" />
}

export function TasksPage() {
  const tasks = useAppStore((state) => state.tasks)
  const refreshTasks = useAppStore((state) => state.refreshTasks)

  return (
    <div className="h-full overflow-auto p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">任务中心</h1>
          <p className="mt-1 text-xs muted">查看下载、解析、转码、上传和同步记录。</p>
        </div>
        <button
          type="button"
          onClick={() => void refreshTasks()}
          className="flex items-center gap-2 rounded-lg border hairline px-3 py-2 text-xs font-semibold"
        >
          <RefreshCw size={15} />
          刷新
        </button>
      </div>

      <div className="panel overflow-hidden">
        {tasks.length === 0 ? (
          <div className="grid h-48 place-items-center text-xs muted">暂无任务记录</div>
        ) : (
          <div className="divide-y hairline">
            {tasks.map((task) => (
              <div key={task.id} className="p-4">
                <div className="flex items-start gap-3">
                  <TaskStatus task={task} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-xs font-semibold">{task.title}</div>
                      <div className="shrink-0 text-[10px] muted">
                        {new Date(task.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] muted">{task.message}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                      <div
                        className={[
                          'h-full rounded-full transition-all',
                          task.status === 'failed' ? 'bg-red-500' : 'bg-[#0f8f7a]'
                        ].join(' ')}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    {task.logs.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[10px] font-semibold muted">
                          查看 {task.logs.length} 条日志
                        </summary>
                        <div className="mt-2 max-h-44 overflow-auto rounded-md border hairline p-2 font-mono text-[10px] leading-4">
                          {task.logs.map((log, index) => (
                            <div key={`${log.at}-${index}`}>
                              [{log.level}] {log.message}
                              {log.details ? ` ${log.details}` : ''}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
