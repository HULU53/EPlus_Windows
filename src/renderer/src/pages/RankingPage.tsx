import { useEffect, useState } from 'react'
import { RefreshCw, Trophy } from 'lucide-react'
import type {
  HomeworkInfo,
  HomeworkListResult,
  RankingEntry
} from '../../../shared/types'
import { useAppStore } from '../store'

function formatRankingTime(value?: string): string {
  if (!value) return ''
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

export function RankingPage() {
  const session = useAppStore((state) => state.session)
  const setPage = useAppStore((state) => state.setPage)
  const [result, setResult] = useState<HomeworkListResult | null>(null)
  const [currentHomeworks, setCurrentHomeworks] = useState<HomeworkInfo[]>([])
  const [selected, setSelected] = useState<HomeworkInfo | null>(null)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [loadingRanking, setLoadingRanking] = useState(false)

  const loadHistory = async () => {
    setLoadingList(true)
    try {
      const [current, history] = await Promise.all([
        window.etsApi.homework.list('1'),
        window.etsApi.homework.list('2')
      ])
      setCurrentHomeworks(current.homeworks)
      setResult(history)
    } catch (error) {
      useAppStore.getState().setError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (session) void loadHistory()
  }, [session])

  const loadRanking = async (homework: HomeworkInfo) => {
    setSelected(homework)
    setRanking([])
    setLoadingRanking(true)
    try {
      setRanking(await window.etsApi.ranking.get(homework.id))
    } catch (error) {
      useAppStore.getState().setError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoadingRanking(false)
    }
  }

  if (!session) {
    return (
      <div className="grid h-full place-items-center">
        <div className="text-center">
          <Trophy size={32} className="mx-auto text-[#0f8f7a]" />
          <div className="mt-3 text-sm font-semibold">请先登录账号</div>
          <button
            type="button"
            onClick={() => setPage('account')}
            className="mt-3 rounded-lg bg-[#0f8f7a] px-3 py-2 text-xs font-semibold text-white"
          >
            前往账号页面
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">排行</h1>
          <p className="mt-1 text-xs muted">从历史作业选择试卷，查看该试卷排行榜。</p>
        </div>
        <button
          type="button"
          disabled={loadingList}
          onClick={() => void loadHistory()}
          className="flex items-center gap-2 rounded-lg border hairline px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          <RefreshCw size={15} className={loadingList ? 'animate-spin' : ''} />
          刷新历史作业
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(420px,.9fr)_minmax(520px,1.1fr)] gap-4">
        <section className="panel flex min-h-0 flex-col overflow-hidden">
          <div className="border-b hairline px-4 py-3">
            <div className="text-sm font-semibold">作业列表</div>
            <div className="mt-0.5 text-[10px] muted">
              当前 {currentHomeworks.length} 份 · 历史 {result?.homeworks.length ?? 0} 份
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {[...currentHomeworks, ...(result?.homeworks ?? [])].map((homework) => {
              const isCurrent = currentHomeworks.some((item) => item.id === homework.id)
              return (
              <button
                key={homework.id}
                type="button"
                onClick={() => void loadRanking(homework)}
                className={[
                  'flex w-full items-center justify-between border-b hairline px-4 py-3 text-left transition',
                  selected?.id === homework.id
                    ? 'bg-[#0f8f7a]/8'
                    : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.025]'
                ].join(' ')}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <span className="shrink-0 rounded-md bg-[#0f8f7a] px-1.5 py-0.5 text-[9px] font-bold text-white">
                        当前
                      </span>
                    )}
                    <span className="truncate text-xs font-semibold">{homework.name}</span>
                  </div>
                  <div className="mt-1 text-[10px] muted">作业 ID {homework.id}</div>
                </div>
                {selected?.id === homework.id && (
                  <Trophy size={15} className="shrink-0 text-[#0f8f7a]" />
                )}
              </button>
              )
            })}
            {!loadingList &&
              currentHomeworks.length === 0 &&
              (result?.homeworks.length ?? 0) === 0 && (
              <div className="grid h-40 place-items-center text-xs muted">暂无历史作业</div>
              )}
          </div>
        </section>

        <section className="panel min-h-0 overflow-hidden">
          <div className="border-b hairline px-4 py-3">
            <div className="text-sm font-semibold">
              {selected ? `${selected.name} · 排行榜` : '排行榜'}
            </div>
            <div className="mt-0.5 text-[10px] muted">
              姓名、总成绩、提交时间（UTC+8）
            </div>
          </div>
          <div className="min-h-0 h-[calc(100%-58px)] overflow-auto">
            {loadingRanking ? (
              <div className="grid h-40 place-items-center text-xs muted">正在加载排行...</div>
            ) : !selected ? (
              <div className="grid h-40 place-items-center text-xs muted">
                从左侧选择一份历史作业
              </div>
            ) : ranking.length === 0 ? (
              <div className="grid h-40 place-items-center text-xs muted">该作业暂无排行数据</div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 border-b hairline bg-[canvas] text-[10px] uppercase tracking-wide muted">
                  <tr>
                    <th className="px-4 py-2 font-semibold">姓名</th>
                    <th className="w-32 px-4 py-2 font-semibold">分数</th>
                    <th className="w-56 px-4 py-2 font-semibold">提交时间（UTC+8）</th>
                  </tr>
                </thead>
                <tbody className="divide-y hairline">
                  {ranking.map((entry, index) => (
                    <tr key={`${entry.userId ?? entry.name}-${index}`}>
                      <td className="px-4 py-3 text-xs font-semibold">{entry.name}</td>
                      <td className="px-4 py-3 text-xs">{entry.score}</td>
                      <td className="px-4 py-3 text-xs muted">
                        {formatRankingTime(entry.finishTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
