import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CloudDownload,
  FileAudio,
  RefreshCw,
  ShieldCheck
} from 'lucide-react'
import { useAppStore } from '../store'

export function OverviewPage() {
  const session = useAppStore((state) => state.session)
  const result = useAppStore((state) => state.homeworkResult)
  const tasks = useAppStore((state) => state.tasks)
  const settings = useAppStore((state) => state.settings)
  const setPage = useAppStore((state) => state.setPage)
  const loadHomeworks = useAppStore((state) => state.loadHomeworks)

  const activeTasks = tasks.filter((task) =>
    ['queued', 'running', 'waiting-auth', 'waiting-confirmation'].includes(task.status)
  )

  return (
    <div className="h-full overflow-auto p-5">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">工作台</h1>
          <p className="mt-1 text-xs muted">
            登录、读取作业、解析试卷，并按题目准备录音和 XML。
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPage('homework')
            void loadHomeworks()
          }}
          disabled={!session}
          className="flex items-center gap-2 rounded-lg bg-[#0f8f7a] px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw size={15} />
          刷新作业
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Metric
          icon={<BookOpenCheck size={18} />}
          label="作业总数"
          value={result?.totalCount ?? '—'}
          hint={result ? `当前状态 ${result.status}` : '登录后加载'}
        />
        <Metric
          icon={<ClipboardList size={18} />}
          label="待完成"
          value={result?.todoCount ?? '—'}
          hint="服务端当前统计"
        />
        <Metric
          icon={<Clock3 size={18} />}
          label="逾期"
          value={result?.overtimeCount ?? '—'}
          hint="需要优先检查"
        />
        <Metric
          icon={<CloudDownload size={18} />}
          label="运行中任务"
          value={activeTasks.length}
          hint={`历史任务 ${tasks.length}`}
        />
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)] gap-4">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b hairline px-4 py-3">
            <div>
              <div className="text-sm font-semibold">当前会话</div>
              <div className="text-[11px] muted">Token、账户和上传安全状态</div>
            </div>
            <button
              type="button"
              onClick={() => setPage('account')}
              className="flex items-center gap-1 text-xs font-semibold text-[#0f8f7a]"
            >
              管理账号 <ArrowRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-px bg-black/5 dark:bg-white/5">
            <InfoCell label="用户 ID" value={session?.userId || '未登录'} />
            <InfoCell label="登录方式" value={session?.loginSource || '—'} />
            <InfoCell label="父账户 ID" value={session?.parentAccountId || '加载后写入'} />
            <InfoCell
              label="Token 到期"
              value={
                session?.tokenExpiresAt
                  ? new Date(session.tokenExpiresAt * 1000).toLocaleString()
                  : '无 exp 或未导入'
              }
            />
          </div>
        </section>

        <section className="panel p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#0f8f7a]" />
            <div className="text-sm font-semibold">提交安全</div>
          </div>
          <div className="mt-4 rounded-lg border hairline p-3">
            <div className="text-xs font-semibold">
              {settings?.dryRun ? '当前为演练模式' : '当前允许实际提交'}
            </div>
            <p className="mt-1 text-[11px] leading-5 muted">
              {settings?.dryRun
                ? '文件会完成转码和 OSS 上传，但不会调用 sync-v2。'
                : '实际提交前仍会显示确认信息，并需要用户明确确认。'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPage('settings')}
            className="mt-3 w-full rounded-lg border hairline px-3 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5"
          >
            调整提交策略
          </button>
        </section>
      </div>

      <section className="panel mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b hairline px-4 py-3">
          <div className="flex items-center gap-2">
            <FileAudio size={16} className="text-[#0f8f7a]" />
            <div className="text-sm font-semibold">最近任务</div>
          </div>
          <button
            type="button"
            onClick={() => setPage('tasks')}
            className="text-xs font-semibold text-[#0f8f7a]"
          >
            查看全部
          </button>
        </div>
        {tasks.length === 0 ? (
          <div className="grid h-32 place-items-center text-xs muted">尚未产生任务</div>
        ) : (
          <div className="divide-y hairline">
            {tasks.slice(0, 6).map((task) => (
              <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                {task.status === 'succeeded' ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <RefreshCw
                    size={16}
                    className={task.status === 'failed' ? 'text-red-500' : 'text-[#0f8f7a]'}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{task.title}</div>
                  <div className="truncate text-[11px] muted">{task.message}</div>
                </div>
                <div className="text-[11px] muted">{task.progress}%</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  hint
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  hint: string
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs muted">{label}</span>
        <span className="text-[#0f8f7a]">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-[10px] muted">{hint}</div>
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[canvas] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide muted">{label}</div>
      <div className="mt-1 break-all text-xs font-semibold">{value}</div>
    </div>
  )
}
