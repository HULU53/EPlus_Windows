import { useEffect, useState } from 'react'
import {
  Check,
  Download,
  FileText,
  FolderOpen,
  ShieldAlert,
  TerminalSquare
} from 'lucide-react'
import { useAppStore } from '../store'
import type { AppSettings } from '../../../shared/types'

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings)
  const saveSettings = useAppStore((state) => state.saveSettings)
  const [logPath, setLogPath] = useState('')

  useEffect(() => {
    void window.etsApi.diagnostics.logPath().then(setLogPath)
  }, [])

  if (!settings) return null

  const update = (patch: Partial<AppSettings>) => void saveSettings(patch)

  return (
    <div className="h-full overflow-auto p-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">设置与诊断</h1>
        <p className="mt-1 text-xs muted">控制主题、提交安全、FFmpeg 和诊断导出。</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4">
        <section className="panel overflow-hidden">
          <SectionTitle title="界面" description="主题跟随系统，也可固定浅色或深色。" />
          <div className="grid grid-cols-3 gap-px bg-black/5 dark:bg-white/5">
            {[
              ['system', '跟随系统'],
              ['light', '浅色'],
              ['dark', '深色']
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ theme: value as AppSettings['theme'] })}
                className={[
                  'flex items-center justify-center gap-2 bg-[canvas] px-4 py-4 text-xs font-semibold',
                  settings.theme === value ? 'text-[#0f8f7a]' : ''
                ].join(' ')}
              >
                {settings.theme === value && <Check size={14} />}
                {label}
              </button>
            ))}
          </div>

          <SectionTitle
            title="提交安全"
            description="演练模式仍会上传 OSS，但不会调用业务同步接口。"
          />
          <div className="space-y-3 p-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border hairline p-3">
              <input
                type="checkbox"
                checked={settings.dryRun}
                onChange={(event) => update({ dryRun: event.target.checked })}
                className="mt-0.5"
              />
              <div>
                <div className="text-xs font-semibold">默认演练模式</div>
                <div className="mt-1 text-[11px] leading-5 muted">
                  开启后只准备并上传文件，不执行 sync-v2。关闭后，每次真实提交仍会弹出确认。
                </div>
              </div>
            </label>
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-[11px] leading-5 text-amber-800 dark:text-amber-200">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              服务端是否接受自定义 XML 和评分取决于业务校验。程序不会绕过服务端校验。
            </div>
          </div>

          <SectionTitle title="音频处理" description="支持 MP3、WAV、M4A、OGG、WebM 和 FLAC 输入。" />
          <div className="p-4">
            <div className="text-[10px] uppercase tracking-wide muted">FFmpeg 路径</div>
            <div className="mt-2 flex gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border hairline px-3 py-2">
                <TerminalSquare size={15} className="text-[#0f8f7a]" />
                <span className="truncate font-mono text-[11px]">{settings.ffmpegPath}</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const path = await window.etsApi.system.pickFfmpeg()
                  if (path) update({ ffmpegPath: path })
                }}
                className="flex items-center gap-2 rounded-lg border hairline px-3 py-2 text-xs font-semibold"
              >
                <FolderOpen size={14} />
                选择
              </button>
            </div>
          </div>

          <SectionTitle
            title="日志记录"
            description="默认写入 %temp%\\E+Desk\\Debug.txt，用于定位登录、网络、ZIP 和上传问题。"
          />
          <div className="space-y-3 p-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border hairline p-3">
              <input
                type="checkbox"
                checked={settings.loggingEnabled}
                onChange={(event) => update({ loggingEnabled: event.target.checked })}
                className="mt-0.5"
              />
              <div>
                <div className="text-xs font-semibold">启用日志记录</div>
                <div className="mt-1 text-[11px] leading-5 muted">
                  关闭后只输出到开发控制台；重新开启会立即追加写入 Debug.txt。
                </div>
              </div>
            </label>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide muted">记录详细度</div>
              <select
                value={settings.logLevel}
                onChange={(event) =>
                  update({ logLevel: event.target.value as AppSettings['logLevel'] })
                }
                className="w-full rounded-lg border hairline bg-transparent px-3 py-2 text-xs"
              >
                <option value="error">仅错误</option>
                <option value="info">标准</option>
                <option value="debug">详细</option>
              </select>
            </div>
            <div className="rounded-lg border hairline p-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <FileText size={14} className="text-[#0f8f7a]" />
                当前日志文件
              </div>
              <div className="mt-2 break-all font-mono text-[10px] muted">
                {logPath || '正在获取路径...'}
              </div>
              <button
                type="button"
                disabled={!logPath}
                onClick={() => void window.etsApi.system.openPath(logPath)}
                className="mt-3 flex items-center gap-2 rounded-lg border hairline px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                <FolderOpen size={14} />
                打开日志文件
              </button>
            </div>
          </div>
        </section>

        <section className="panel p-4">
          <div className="flex items-center gap-2">
            <Download size={17} className="text-[#0f8f7a]" />
            <div className="text-sm font-semibold">诊断导出</div>
          </div>
          <p className="mt-2 text-[11px] leading-5 muted">
            导出设置、脱敏会话信息和任务日志，便于定位接口与转码问题。
          </p>
          <button
            type="button"
            onClick={async () => {
              const path = await window.etsApi.diagnostics.export()
              await window.etsApi.system.openPath(path)
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f8f7a] px-3 py-2 text-xs font-semibold text-white"
          >
            <Download size={14} />
            导出诊断 JSON
          </button>
          <div className="mt-5 border-t hairline pt-4">
            <div className="text-[10px] uppercase tracking-wide muted">关于</div>
            <button
              type="button"
              onClick={(event) => {
                if (event.ctrlKey && event.button === 0) {
                  void window.etsApi.system.openExternal('https://github.com/HULU53/')
                }
              }}
              className="mt-2 text-xs font-semibold text-[#0f8f7a] underline-offset-2 hover:underline"
              aria-label="作者:HULU53@Github"
            >
              作者:HULU53@Github
            </button>
          </div>
          <div className="mt-5 border-t hairline pt-4">
            <div className="text-[10px] uppercase tracking-wide muted">并发限制</div>
            <select
              value={settings.maxDownloads}
              onChange={(event) => update({ maxDownloads: Number(event.target.value) })}
              className="mt-2 w-full rounded-lg border hairline bg-transparent px-3 py-2 text-xs"
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  下载并发 {value}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>

      <section className="panel mt-4 overflow-hidden">
        <SectionTitle
          title="实验性"
          description="高风险功能，仅在明确理解后果时开启。"
        />
        <label className="flex cursor-pointer items-start gap-3 p-4">
          <input
            type="checkbox"
            checked={settings.experimentalCustomScoreEnabled}
            onChange={(event) =>
              update({ experimentalCustomScoreEnabled: event.target.checked })
            }
            className="mt-0.5"
          />
          <div>
            <div className="text-xs font-semibold">自定义得分</div>
            <div className="mt-1 text-[10px] font-medium text-red-600 dark:text-red-400">
              该选项开启后可能导致ETS账号被封禁，慎重！
            </div>
          </div>
        </label>
      </section>
    </div>
  )
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-y hairline px-4 py-3 first:border-t-0">
      <div className="text-xs font-semibold">{title}</div>
      <div className="mt-1 text-[11px] muted">{description}</div>
    </div>
  )
}
