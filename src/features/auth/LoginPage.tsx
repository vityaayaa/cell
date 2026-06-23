import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/data/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.string().min(1, 'Введите email').email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

type FormData = z.infer<typeof schema>

const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Неверный email или пароль',
  'Email not confirmed': 'Подтвердите email перед входом',
  'User not found': 'Пользователь не найден',
  'Too many requests': 'Слишком много попыток. Подождите немного',
}

function mapError(msg: string): string {
  for (const [key, val] of Object.entries(ERROR_MAP)) {
    if (msg.includes(key)) return val
  }
  return 'Ошибка входа. Попробуйте снова'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    setLoading(false)

    if (error) {
      toast.error(mapError(error.message))
      return
    }

    navigate('/app/home', { replace: true })
  }

  async function handleForgotPassword() {
    const email = getValues('email')
    if (!email) {
      toast.error('Введите email для сброса пароля')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      toast.error('Не удалось отправить письмо. Проверьте email')
    } else {
      toast.success('Письмо со сбросом пароля отправлено')
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-dvh px-4"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            CELL
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Войдите в аккаунт
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email" style={{ color: 'var(--foreground)' }}>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="ivan@example.com"
              {...register('email')}
              style={{
                height: 48,
                borderColor: errors.email ? 'var(--destructive)' : undefined,
              }}
            />
            {errors.email && (
              <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" style={{ color: 'var(--foreground)' }}>
              Пароль
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('password')}
                style={{
                  height: 48,
                  paddingRight: 48,
                  borderColor: errors.password ? 'var(--destructive)' : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-0 top-0 flex items-center justify-center"
                style={{ width: 48, height: 48, color: 'var(--muted-foreground)' }}
                tabIndex={-1}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
            style={{
              height: 56,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {loading ? 'Вход...' : 'Войти'}
          </Button>
        </form>

        <button
          type="button"
          onClick={handleForgotPassword}
          className="w-full text-sm text-center"
          style={{ color: 'var(--primary)', minHeight: 44 }}
        >
          Забыл пароль?
        </button>

        <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
          Первый запуск?{' '}
          <Link
            to="/onboarding"
            style={{ color: 'var(--primary)', textDecoration: 'underline' }}
          >
            Создать аккаунт администратора
          </Link>
        </p>
      </div>
    </div>
  )
}
