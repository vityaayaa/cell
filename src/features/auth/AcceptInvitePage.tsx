import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/data/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  // The invite link lands here with the session token in the URL; supabase-js
  // consumes it and fires onAuthStateChange. We wait for that session, then let
  // the new user set a password.
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setStatus('ready')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) setStatus('ready')
    })
    const t = setTimeout(() => {
      setStatus((cur) => (cur === 'checking' ? 'invalid' : cur))
    }, 3000)
    return () => {
      cancelled = true
      subscription.unsubscribe()
      clearTimeout(t)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Пароль не короче 6 символов')
      return
    }
    if (password !== confirm) {
      setError('Пароли не совпадают')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (err) {
      setError('Не удалось задать пароль. Откройте ссылку из письма заново.')
      return
    }
    toast.success('Пароль установлен')
    navigate('/app/home', { replace: true })
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-dvh px-6"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full" style={{ maxWidth: 360 }}>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
          Приглашение в CELL
        </h1>

        {status === 'checking' && (
          <div className="flex items-center justify-center py-10">
            <div
              className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
            />
          </div>
        )}

        {status === 'invalid' && (
          <div className="mt-4">
            <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Ссылка-приглашение недействительна или устарела. Попросите администратора
              отправить приглашение заново.
            </p>
            <Link to="/login" className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
              ← На страницу входа
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <>
            <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>
              Придумайте пароль для входа.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="pwd">Пароль</Label>
                <div className="relative">
                  <Input
                    id="pwd"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ height: 48 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
                    style={{ width: 40, height: 40, color: 'var(--muted-foreground)' }}
                    aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pwd2">Повторите пароль</Label>
                <Input
                  id="pwd2"
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={{ height: 48 }}
                />
              </div>

              {error && (
                <p className="text-sm" style={{ color: 'var(--destructive)' }}>
                  {error}
                </p>
              )}

              <Button type="submit" className="btn-primary w-full" style={{ height: 52 }} disabled={saving}>
                {saving ? '…' : 'Войти'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
