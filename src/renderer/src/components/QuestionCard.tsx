import { useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  FileAudio,
  FileCode2,
  Mic,
  Save,
  Send,
  Square,
  Trash2,
  Wand2
} from 'lucide-react'
import type {
  AttachmentKind,
  Question,
  QuestionAttachment,
  ScoreData,
  UploadContext
} from '../../../shared/types'
import { useAppStore } from '../store'

function attachmentLabel(attachment: QuestionAttachment): string {
  const size =
    attachment.size > 1024 * 1024
      ? `${(attachment.size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(attachment.size / 1024))} KB`
  return `${attachment.fileName} · ${size}`
}

export function QuestionCard({ question }: { question: Question }) {
  const paper = useAppStore((state) => state.paper)!
  const settings = useAppStore((state) => state.settings)!
  const tasks = useAppStore((state) => state.tasks)
  const [advanced, setAdvanced] = useState(false)
  const [score, setScore] = useState<ScoreData>(
    question.scoreOverride ?? {
      totalScore: '0.0',
      choose: '',
      fluencyScore: '0.0',
      accuracyScore: '0.0',
      integrityScore: '0.0',
      standardScore: '0.0',
      category: question.structureType || 'simple_expression',
      repeatMode: '0',
      version: '7.0.71.2569(2569)',
      rateScale: 0,
      source: 'manual'
    }
  )
  const [context, setContext] = useState<UploadContext>(
    question.uploadContext ?? {
      homeworkId: paper.homeworkId,
      resourceId: '',
      setId: '',
      entityId: '',
      order: String(question.order),
      serialId: '0',
      useTime: 0,
      score: '0.0',
      correct: 0,
      markTraceId: ''
    }
  )
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const currentTask = useMemo(
    () => tasks.find((task) => task.id === question.uploadState?.taskId),
    [tasks, question.uploadState?.taskId]
  )
  const isChoice =
    question.structureType === 'collector.choose' && (question.options?.length ?? 0) > 0

  const updatePaperQuestion = (updater: (item: Question) => Question) => {
    useAppStore.setState((state) => ({
      paper: state.paper
        ? {
            ...state.paper,
            sections: state.paper.sections.map((section) => ({
              ...section,
              questions: section.questions.map((item) =>
                item.id === question.id ? updater(item) : item
              )
            }))
          }
        : null
    }))
  }

  const attachBytes = async (
    kind: AttachmentKind,
    fileName: string,
    mimeType: string,
    bytes: Uint8Array,
    source: 'file' | 'recording'
  ) => {
    const attachment =
      source === 'recording'
        ? await window.etsApi.paper.attachRecording({
            paperId: paper.id,
            questionId: question.id,
            kind,
            fileName,
            mimeType,
            bytes
          })
        : await window.etsApi.paper.attachFile({
            paperId: paper.id,
            questionId: question.id,
            kind,
            fileName,
            mimeType,
            bytes
          })
    updatePaperQuestion((item) => ({
      ...item,
      attachments: [
        ...item.attachments.filter((entry) => entry.kind !== kind),
        attachment
      ]
    }))
    if (kind === 'xml') {
      const scoreText = new TextDecoder().decode(bytes)
      const total = scoreText.match(/total_score="([^"]+)"/)?.[1]
      if (total) {
        const detected = { ...score, totalScore: total, source: 'xml' as const }
        setScore(detected)
        await window.etsApi.paper.setScoreOverride(paper.id, question.id, detected)
      }
    }
  }

  const selectFile = async (kind: AttachmentKind) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept =
      kind === 'xml'
        ? '.xml,text/xml,application/xml'
        : '.mp3,.wav,.m4a,.ogg,.webm,.flac,audio/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      await attachBytes(
        kind,
        file.name,
        file.type || (kind === 'xml' ? 'application/xml' : 'audio/*'),
        new Uint8Array(await file.arrayBuffer()),
        'file'
      )
    }
    input.click()
  }

  const removeAttachment = async (kind: AttachmentKind) => {
    const item = question.attachments.find((entry) => entry.kind === kind)
    if (!item) return
    await window.etsApi.paper.removeAttachment(paper.id, question.id, item.id)
    updatePaperQuestion((current) => ({
      ...current,
      attachments: current.attachments.filter((entry) => entry.id !== item.id),
      uploadState: undefined
    }))
  }

  const generateFullScore = async () => {
    const result = await window.etsApi.paper.generateFullScoreXml(paper.id, question.id)
    setScore(result.score)
    setContext(result.uploadContext)
    updatePaperQuestion((current) => ({
      ...current,
      attachments: [
        ...current.attachments.filter((entry) => entry.kind !== 'xml'),
        result.attachment
      ],
      scoreOverride: result.score,
      uploadContext: result.uploadContext,
      uploadState: undefined
    }))
  }

  const selectChoice = async (answer: string) => {
    await window.etsApi.paper.setChoiceAnswer(paper.id, question.id, answer)
    updatePaperQuestion((current) => ({
      ...current,
      selectedAnswer: answer
    }))
  }

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    chunksRef.current = []
    recorderRef.current = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop())
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      setRecording(false)
      await attachBytes(
        'audio',
        `recording-${Date.now()}.webm`,
        blob.type,
        new Uint8Array(await blob.arrayBuffer()),
        'recording'
      )
    }
    recorder.start()
    setRecording(true)
  }

  const saveAdvanced = async () => {
    await window.etsApi.paper.setScoreOverride(paper.id, question.id, score)
    await window.etsApi.paper.setUploadContext(paper.id, question.id, context)
    updatePaperQuestion((item) => ({
      ...item,
      scoreOverride: score,
      uploadContext: context
    }))
  }

  const submit = async () => {
    const request = {
      paperId: paper.id,
      questionId: question.id,
      confirmRealSubmit:
        settings.dryRun ||
        window.confirm(
          `确认实际提交？\n\n${paper.title}\n第 ${question.order} 题\n总分：${score.totalScore}`
        )
    }
    const validation = await window.etsApi.upload.validate(request)
    if (!validation.ok) {
      useAppStore.getState().setError(validation.errors.join('；'))
      return
    }
    const task = await window.etsApi.upload.submit(request)
    updatePaperQuestion((item) => ({
      ...item,
      uploadState: {
        status: 'uploading',
        taskId: task.id,
        message: '任务已创建',
        updatedAt: Date.now()
      }
    }))
  }

  return (
    <article className="rounded-lg border hairline bg-[canvas]">
      <div className="flex items-start gap-3 border-b hairline px-4 py-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#0f8f7a]/10 text-xs font-bold text-[#0f8f7a]">
          {question.order}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="whitespace-pre-wrap text-xs font-semibold leading-5">
              {question.questionText || '无题干'}
            </div>
            <span className="shrink-0 rounded-md border hairline px-2 py-0.5 text-[10px] muted">
              {question.maxScore ?? 5} 分
            </span>
          </div>
          {question.answers.length > 0 && (
            <div className="mt-2 rounded-md border hairline bg-black/[0.015] px-3 py-2 text-[11px] leading-5 dark:bg-white/[0.015]">
              <span className="mr-2 font-semibold text-[#0f8f7a]">参考答案</span>
              {question.answers.join(' / ')}
            </div>
          )}
          {question.originalText && (
            <div className="mt-2 whitespace-pre-wrap rounded-md border hairline px-3 py-2 text-[11px] leading-5 muted">
              {question.originalText}
            </div>
          )}
        </div>
        {currentTask && (
          <div className="shrink-0 rounded-md border hairline px-2 py-1 text-[10px] muted">
            {currentTask.message} · {currentTask.progress}%
          </div>
        )}
      </div>

      {isChoice ? (
        <div className="space-y-2 px-4 py-3">
          {question.options?.map((option, index) => (
            <button
              key={`${option.label}-${index}`}
              type="button"
              onClick={() => void selectChoice(option.label)}
              className={[
                'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                question.selectedAnswer === option.label
                  ? 'border-[#0f8f7a] bg-[#0f8f7a]/8'
                  : 'hairline hover:bg-black/[0.025] dark:hover:bg-white/[0.025]'
              ].join(' ')}
            >
              <span
                className={[
                  'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold',
                  question.selectedAnswer === option.label
                    ? 'border-[#0f8f7a] bg-[#0f8f7a] text-white'
                    : 'hairline text-[#0f8f7a]'
                ].join(' ')}
              >
                {option.label || String.fromCharCode(65 + index)}
              </span>
              <span className="pt-0.5 text-[11px] leading-5">{option.text}</span>
            </button>
          ))}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={!question.selectedAnswer}
              onClick={() => void submit()}
              className="flex items-center gap-2 rounded-lg bg-[#0f8f7a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              <Send size={14} />
              {settings.dryRun ? '演练本题' : '提交本题'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 py-3">
          <AttachmentSlot
            title={`音频文件 · 满分 ${question.maxScore ?? 5} 分`}
            icon={<FileAudio size={15} />}
            attachment={question.attachments.find((item) => item.kind === 'audio')}
            onSelect={() => void selectFile('audio')}
            onClear={() => void removeAttachment('audio')}
          />
          <AttachmentSlot
            title={`XML 评测数据 · 满分 ${question.maxScore ?? 5} 分`}
            icon={<FileCode2 size={15} />}
            attachment={question.attachments.find((item) => item.kind === 'xml')}
            onSelect={() => void selectFile('xml')}
            onClear={() => void removeAttachment('xml')}
            onPreset={() => void generateFullScore()}
          />
        </div>
      )}

      {!isChoice && (
      <div className="flex items-center justify-between border-t hairline px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (recording ? recorderRef.current?.stop() : void startRecording())}
            className={[
              'flex items-center gap-2 rounded-lg border hairline px-3 py-2 text-xs font-semibold',
              recording ? 'border-red-500/40 text-red-500' : ''
            ].join(' ')}
          >
            {recording ? <Square size={14} /> : <Mic size={14} />}
            {recording ? '停止录音' : '浏览器录音'}
          </button>
          <button
            type="button"
            onClick={() => setAdvanced((value) => !value)}
            className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs muted hover:text-current"
          >
            高级设置 <ChevronDown size={14} className={advanced ? 'rotate-180' : ''} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          className="flex items-center gap-2 rounded-lg bg-[#0f8f7a] px-3 py-2 text-xs font-semibold text-white"
        >
          <Send size={14} />
          {settings.dryRun ? '演练上传' : '确认并提交'}
        </button>
      </div>
      )}

      {advanced && !isChoice && (
        <div className="border-t hairline bg-black/[0.012] p-4 dark:bg-white/[0.012]">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold">评分与业务上下文</div>
            <button
              type="button"
              onClick={() => void saveAdvanced()}
              className="flex items-center gap-1 text-[11px] font-semibold text-[#0f8f7a]"
            >
              <Save size={13} /> 保存覆盖
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Field label="总分" value={score.totalScore} onChange={(value) => setScore({ ...score, totalScore: value })} />
            <Field label="准确度" value={score.accuracyScore} onChange={(value) => setScore({ ...score, accuracyScore: value })} />
            <Field label="流利度" value={score.fluencyScore} onChange={(value) => setScore({ ...score, fluencyScore: value })} />
            <Field label="完整度" value={score.integrityScore} onChange={(value) => setScore({ ...score, integrityScore: value })} />
            <Field label="resource_id" value={context.resourceId} onChange={(value) => setContext({ ...context, resourceId: value })} />
            <Field label="set_id" value={context.setId} onChange={(value) => setContext({ ...context, setId: value })} />
            <Field label="entity_id" value={context.entityId} onChange={(value) => setContext({ ...context, entityId: value })} />
            <Field label="order" value={context.order} onChange={(value) => setContext({ ...context, order: value })} />
            <Field label="serial_id" value={context.serialId ?? '0'} onChange={(value) => setContext({ ...context, serialId: value })} />
            <Field label="use_time" value={String(context.useTime ?? 0)} onChange={(value) => setContext({ ...context, useTime: Number(value) || 0 })} />
            <Field label="score" value={context.score ?? score.totalScore} onChange={(value) => setContext({ ...context, score: value })} />
            <Field label="correct" value={String(context.correct ?? 0)} onChange={(value) => setContext({ ...context, correct: Number(value) || 0 })} />
            <Field label="mark_trace_id" value={context.markTraceId ?? ''} onChange={(value) => setContext({ ...context, markTraceId: value })} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] muted">
            <CheckCircle2 size={13} />
            评分来源：{score.source}。XML 自动结果可被此处覆盖。
          </div>
        </div>
      )}
    </article>
  )
}

function AttachmentSlot({
  title,
  icon,
  attachment,
  onSelect,
  onClear,
  onPreset
}: {
  title: string
  icon: React.ReactNode
  attachment?: QuestionAttachment
  onSelect(): void
  onClear(): void
  onPreset?(): void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border hairline px-3 py-2.5">
      <span className="text-[#0f8f7a]">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold">{title}</div>
        <div className="truncate text-[10px] muted">
          {attachment ? attachmentLabel(attachment) : '尚未选择'}
        </div>
      </div>
      <button type="button" onClick={onSelect} className="text-[11px] font-semibold text-[#0f8f7a]">
        {attachment ? '替换' : '选择'}
      </button>
      {onPreset && (
        <button
          type="button"
          onClick={onPreset}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#0f8f7a]"
          title="生成满分 XML"
        >
          <Wand2 size={13} />
          满分
        </button>
      )}
      {attachment && (
        <button type="button" onClick={onClear} className="text-red-500">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange(value: string): void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border hairline bg-transparent px-2 py-1.5 font-mono text-[11px] outline-none"
      />
    </label>
  )
}
