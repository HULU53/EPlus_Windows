import * as Tabs from '@radix-ui/react-tabs'
import { BookOpen, ChevronRight, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import type { HomeworkStatus } from '../../../shared/types'
import { useAppStore } from '../store'

const STATUS = [
  { value: '1', label: '当前' },
  { value: '2', label: '历史' },
  { value: '3', label: '过期' }
] as const

export function HomeworkPage() {
  const session = useAppStore((state) => state.session)
  const status = useAppStore((state) => state.homeworkStatus)
  const result = useAppStore((state) => state.homeworkResult)
  const loading = useAppStore((state) => state.loading)
  const loadHomeworks = useAppStore((state) => state.loadHomeworks)
  const openHomework = useAppStore((state) => state.openHomework)
  const setPage = useAppStore((state) => state.setPage)
  const [query, setQuery] = useState('')

  if (!session) {
    return (
      <div className="grid h-full place-items-center">
        <div className="text-center">
          <BookOpen size={32} className="mx-auto text-[#0f8f7a]" />
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

  const homeworks = (result?.homeworks ?? []).filter((homework) =>
    homework.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <div className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">作业列表</h1>
          <p className="mt-1 text-xs muted">点击作业后下载资源包并解析结构化试卷。</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadHomeworks()}
          className="flex items-center gap-2 rounded-lg border hairline px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b hairline px-3 py-2">
          <Tabs.Root
            value={status}
            onValueChange={(value) => void loadHomeworks(value as HomeworkStatus)}
          >
            <Tabs.List className="flex gap-1">
              {STATUS.map((item) => (
                <Tabs.Trigger
                  key={item.value}
                  value={item.value}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold muted data-[state=active]:bg-black/5 data-[state=active]:text-current dark:data-[state=active]:bg-white/10"
                >
                  {item.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>
          <label className="flex w-64 items-center gap-2 rounded-lg border hairline px-2.5 py-1.5">
            <Search size={14} className="muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索作业"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </label>
        </div>

        {homeworks.length === 0 ? (
          <div className="grid flex-1 place-items-center text-xs muted">
            {loading ? '正在加载作业...' : '当前分类没有作业'}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 border-b hairline bg-[canvas] text-[10px] uppercase tracking-wide muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">作业</th>
                  <th className="w-24 px-4 py-2 font-semibold">资源包</th>
                  <th className="w-28 px-4 py-2 font-semibold">状态</th>
                  <th className="w-20 px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y hairline">
                {homeworks.map((homework) => (
                  <tr
                    key={homework.id}
                    className="group cursor-pointer transition hover:bg-black/[0.025] dark:hover:bg-white/[0.025]"
                    onClick={() => void openHomework(homework)}
                  >
                    <td className="px-4 py-3">
                      <div className="line-clamp-1 text-xs font-semibold">{homework.name}</div>
                      <div className="mt-1 line-clamp-1 text-[10px] muted">
                        ID {homework.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">{homework.contents.length}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md border hairline px-2 py-1 text-[10px]">
                        {homework.status === '1'
                          ? '当前'
                          : homework.status === '2'
                            ? '历史'
                            : '过期'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight
                        size={16}
                        className="ml-auto muted transition group-hover:text-[#0f8f7a]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
