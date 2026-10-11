import { useState } from 'react'
import {
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  LogOut,
  ShieldCheck,
  Upload
} from 'lucide-react'
import { useAppStore } from '../store'

export function AccountPage() {
  const session = useAppStore((state) => state.session)
  const loading = useAppStore((state) => state.loading)
  const loginPassword = useAppStore((state) => state.loginPassword)
  const startWebLogin = useAppStore((state) => state.startWebLogin)
  const importToken = useAppStore((state) => state.importToken)
  const logout = useAppStore((state) => state.logout)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [rememberPassword, setRememberPassword] = useState(true)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [token, setToken] = useState('')

  return (
    <div className="h-full overflow-auto p-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">账号与会话</h1>
        <p className="mt-1 text-xs muted">
          使用 E 听说学生端手机号和密码登录。Token 和可选密码仅以加密形式保存在本机。
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_390px] gap-4">
        <section className="panel overflow-hidden">
          <div className="border-b hairline px-4 py-3">
            <div className="text-sm font-semibold">当前会话</div>
          </div>
          {session ? (
            <div className="grid grid-cols-2 gap-px bg-black/5 dark:bg-white/5">
              <Info label="用户 ID" value={session.userId || '—'} />
              <Info label="登录标识" value={session.login || '—'} />
              <Info label="登录来源" value={session.loginSource} />
              <Info label="协议模式" value={session.protocolMode} />
              <Info label="父账户 ID" value={session.parentAccountId || '尚未加载'} />
              <Info label="班级 ID" value={session.classId || '—'} />
              <Info
                label="Token 创建"
                value={
                  session.tokenCreatedAt
                    ? new Date(session.tokenCreatedAt * 1000).toLocaleString()
                    : '—'
                }
              />
              <Info
                label="Token 到期"
                value={
                  session.tokenExpiresAt
                    ? new Date(session.tokenExpiresAt * 1000).toLocaleString()
                    : '无 exp'
                }
              />
            </div>
          ) : (
            <div className="grid h-48 place-items-center text-xs muted">当前未登录</div>
          )}
          <div className="flex gap-2 border-t hairline p-4">
            <button
              type="button"
              disabled={!session}
              onClick={() => void logout()}
              className="flex items-center gap-2 rounded-lg border hairline px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              <LogOut size={15} />
              退出并清除会话
            </button>
          </div>
        </section>

        <div className="space-y-4">
          <section className="panel p-4">
            <div className="flex items-center gap-2">
              <LogIn size={17} className="text-[#0f8f7a]" />
              <div className="text-sm font-semibold">手机号密码登录</div>
            </div>
            <p className="mt-2 text-[11px] leading-5 muted">
              与 `G:\Codex\fe` 源码一致：先调用 `/user/login`，如返回 `30014` 则自动调用
              `/user/rebind-code` 完成设备绑定。
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[10px] muted">手机号</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="18200000000"
                  inputMode="numeric"
                  className="w-full rounded-lg border hairline bg-transparent px-3 py-2 text-xs outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] muted">密码</span>
                <div className="flex items-center rounded-lg border hairline px-3">
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={passwordVisible ? 'text' : 'password'}
                    className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((value) => !value)}
                    className="muted"
                    aria-label={passwordVisible ? '隐藏密码' : '显示密码'}
                  >
                    {passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(event) => setRememberPassword(event.target.checked)}
                />
                使用 safeStorage 加密保存密码，以便 Token 失效后自动重新登录
              </label>
              <button
                type="button"
                disabled={loading || !phone.trim() || !password}
                onClick={() => void loginPassword(phone.trim(), password, rememberPassword)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f8f7a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                <LogIn size={15} />
                {loading ? '正在登录...' : '登录 ETS100'}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void startWebLogin()}
                  className="text-[11px] font-medium text-[#0f8f7a] underline-offset-2 hover:underline disabled:opacity-40"
                >
                  讯飞登录
                </button>
              </div>
            </div>
          </section>

          <section className="panel p-4">
            <div className="flex items-center gap-2">
              <KeyRound size={17} className="text-[#0f8f7a]" />
              <div className="text-sm font-semibold">导入旧版 Token</div>
            </div>
            <textarea
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="eyJ0eXAiOiJKV1Qi..."
              className="mt-3 h-24 w-full resize-none rounded-lg border hairline bg-transparent p-3 font-mono text-[11px] outline-none"
            />
            <button
              type="button"
              disabled={!token.trim() || loading}
              onClick={() => void importToken(token)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border hairline px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              <Upload size={15} />
              导入 Token
            </button>
            <div className="mt-4 flex items-start gap-2 rounded-lg border hairline p-3 text-[11px] leading-5 muted">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#0f8f7a]" />
              会话文件使用 Electron safeStorage 加密。“讯飞登录”适用于畅言/企业账号，无法登录学生端账号时请使用手机号密码登录。
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[canvas] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide muted">{label}</div>
      <div className="mt-1 break-all text-xs font-semibold">{value}</div>
    </div>
  )
}
