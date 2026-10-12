import { useState } from 'react'
import {
  ArrowLeft,
  BookOpenCheck,
  FileJson2,
  LoaderCircle,
  Send,
  Wand2
} from 'lucide-react'
import { useAppStore } from '../store'
import { QuestionCard } from '../components/QuestionCard'

export function PaperPage() {
  const paper = useAppStore((state) => state.paper)
  const closePaper = useAppStore((state) => state.closePaper)
  const settings = useAppStore((state) => state.settings)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [customLoading, setCustomLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [customScore, setCustomScore] = useState('40')

  if (!paper) return null
  const questionCount = paper.sections.reduce(
    (sum, section) => sum + section.questions.length,
    0
  )

  const applyTemplate = async () => {
    if (
      !window.confirm(
        '将为所有非选择题生成满分 XML 和 1 秒静音录音，并覆盖现有附件。继续吗？'
      )
    ) {
      return
    }
    setTemplateLoading(true)
    setNotice(null)
    try {
      const result = await window.etsApi.paper.applyFullScoreTemplate(paper.id)
      useAppStore.setState({ paper: result.paper })
      setNotice(
        `已为 ${result.templated} 道题应用满分模板，跳过 ${result.skipped} 道选择题。`
      )
    } catch (error) {
      useAppStore.getState().setError(error instanceof Error ? error.message : String(error))
    } finally {
      setTemplateLoading(false)
    }
  }

  const customScoreNumber = Number(customScore)
  const customScoreValid =
    /^\d+$/.test(customScore) &&
    Number.isInteger(customScoreNumber) &&
    customScoreNumber >= 15 &&
    customScoreNumber <= 2_147_483_647

  const applyCustomTemplate = async () => {
    if (!customScoreValid) {
      useAppStore.getState().setError('自定义总分必须是 15 到 2147483647 之间的整数')
      return
    }
    if (
      !window.confirm(
        `将按自定义总分 ${customScoreNumber} 分重算三部分 XML，并覆盖现有附件。继续吗？`
      )
    ) {
      return
    }
    setCustomLoading(true)
    setNotice(null)
    try {
      const result = await window.etsApi.paper.applyCustomScoreTemplate(
        paper.id,
        customScoreNumber
      )
      useAppStore.setState({ paper: result.paper })
      setNotice(
        `已生成自定义得分模板：听后回答 ${result.listeningAnswerExternal} 分，` +
          `听后转述 ${result.retellExternal} 分，短文朗读 ${result.readingExternal} 分。`
      )
    } catch (error) {
      useAppStore.getState().setError(error instanceof Error ? error.message : String(error))
    } finally {
      setCustomLoading(false)
    }
  }

  const submitAll = async () => {
    const realSubmit =
      settings?.dryRun === false &&
      window.confirm('当前为实际提交模式，将逐题调用业务同步接口。确认继续吗？')
    setSubmitLoading(true)
    setNotice(null)
    try {
      const result = await window.etsApi.paper.submitAll(paper.id, realSubmit)
      useAppStore.setState({ paper: result.paper })
      setNotice(
        `已处理 ${result.submitted} 道题，跳过 ${result.skipped} 道未配置或选择题。` +
          (result.failed.length ? `失败 ${result.failed.length} 道。` : '')
      )
      if (result.failed.length) {
        useAppStore.getState().setError(result.failed.join('；'))
      }
    } catch (error) {
      useAppStore.getState().setError(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b hairline px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={closePaper}
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border hairline hover:bg-black/5 dark:hover:bg-white/5"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight">{paper.title}</h1>
            <div className="mt-1 flex items-center gap-3 text-[11px] muted">
              <span className="flex items-center gap-1">
                <BookOpenCheck size={13} /> {paper.sections.length} 个题型
              </span>
              <span>{questionCount} 道题</span>
              <span>作业 ID {paper.homeworkId}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {settings?.experimentalCustomScoreEnabled && (
            <div className="flex items-center rounded-lg border hairline p-1">
              <input
                value={customScore}
                onChange={(event) =>
                  setCustomScore(event.target.value.replace(/\D/g, '').slice(0, 10))
                }
                inputMode="numeric"
                className="w-20 bg-transparent px-2 py-1 text-center font-mono text-[11px] outline-none"
                aria-label="自定义总分"
              />
              <button
                type="button"
                disabled={!customScoreValid || customLoading}
                onClick={() => void applyCustomTemplate()}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-medium hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5"
              >
                {customLoading ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Wand2 size={14} />
                )}
                提交 {customScore || '__'} 分的成绩
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={templateLoading}
            onClick={() => void applyTemplate()}
            className="flex items-center gap-2 rounded-lg border hairline px-3 py-2 text-[11px] font-medium hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5"
          >
            {templateLoading ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <Wand2 size={14} />
            )}
            一键使用模板
          </button>
          <button
            type="button"
            disabled={submitLoading}
            onClick={() => void submitAll()}
            className="flex items-center gap-2 rounded-lg border hairline px-3 py-2 text-[11px] font-medium hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5"
          >
            {submitLoading ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            一键提交
          </button>
          <div className="flex items-center gap-2 rounded-lg border hairline px-3 py-2 text-[11px] muted">
            <FileJson2 size={14} />
            已解析并缓存
          </div>
        </div>
      </div>

      {notice && (
        <div className="border-b hairline bg-[#0f8f7a]/8 px-5 py-2 text-[11px] text-[#0f8f7a]">
          {notice}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div className="mx-auto max-w-[1120px] space-y-5">
          {paper.sections.map((section, index) => (
            <section key={`${section.caption}-${index}`} className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b hairline px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{section.caption || section.typeName}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide muted">
                    {section.structureType || 'unknown'}
                  </div>
                </div>
                <span className="rounded-md border hairline px-2 py-1 text-[10px]">
                  {section.questions.length} 题
                </span>
              </div>
              <div className="space-y-3 p-3">
                {section.questions.map((question) => (
                  <QuestionCard key={question.id} question={question} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
