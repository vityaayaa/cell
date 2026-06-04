import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/data/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  name: z.string().min(1, 'Введите имя'),
  email: z.string().min(1, 'Введите email').email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
})

type FormData = z.infer<typeof schema>

type PageState = 'checking' | 'form' | 'submitting'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<PageState>('checking')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    async function checkFirstRun() {
      try {
        const { data, error } = await supabase.functions.invoke('create-first-admin', {
          body: {},
        })

        if (error || data?.alreadyExists) {
          navigate('/login', { replace: true })
          return
        }

        setState('form')
      } catch {
        navigate('/login', { replace: true })
      }
    }

    checkFirstRun()
  }, [navigate])

  async function onSubmit(data: FormData) {
    setState('submitting')

    const { error } = await supabase.functions.invoke('create-first-admin', {
      body: { name: data.name, email: data.email, password: data.password },
    })

    if (error) {
      toast.error('Не удалось создать аккаунт. Попробуйте снова')
      setState('form')
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (signInError) {
      toast.error('Аккаунт создан. Войдите вручную')
      navigate('/login', { replace: true })
      return
    }

    navigate('/app/home', { replace: true })
  }

  if (state === 'checking') {
    return (
      <div
        className="flex items-center justify-center min-h-dvh"
        style={{ background: 'var(--background)' }}
      >
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Проверка...
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-dvh px-4"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            Первый запуск
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Создайте аккаунт администратора
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name" style={{ color: 'var(--foreground)' }}>Имя</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Иван"
              {...register('name')}
              style={{
                height: 48,
                borderColor: errors.name ? 'var(--destructive)' : undefined,
              }}
            />
            {errors.name && (
              <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" style={{ color: 'var(--foreground)' }}>Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="admin@example.com"
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
            <Label htmlFor="password" style={{ color: 'var(--foreground)' }}>Пароль</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Минимум 8 символов"
              {...register('password')}
              style={{
                height: 48,
                borderColor: errors.password ? 'var(--destructive)' : undefined,
              }}
            />
            {errors.password && (
              <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={state === 'submitting'}
            style={{
              height: 56,
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {state === 'submitting' ? 'Создание...' : 'Создать аккаунт'}
          </Button>
        </form>
      </div>
    </div>
  )
}
