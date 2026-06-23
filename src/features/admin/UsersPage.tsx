import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Plus, UserX, UserCheck, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { supabase } from '@/data/supabase'
import { useAppStore } from '@/data/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const schema = z.object({
  name: z.string().min(1, 'Введите имя'),
  email: z.string().min(1, 'Введите email').email('Некорректный email'),
  role: z.enum(['admin', 'employee']),
})

type FormData = z.infer<typeof schema>

export default function UsersPage() {
  const navigate = useNavigate()
  const currentUserId = useAppStore((s) => s.userId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const profiles = useLiveQuery(() => db.user_profiles.toArray(), [])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'employee' },
  })

  async function onAdd(data: FormData) {
    setSubmitting(true)
    const { error } = await supabase.functions.invoke('create-user', {
      body: {
        name: data.name,
        email: data.email,
        role: data.role,
        redirectTo: `${window.location.origin}/accept-invite`,
      },
    })
    setSubmitting(false)

    if (error) {
      toast.error('Не удалось создать пользователя')
      return
    }

    toast.success(`Приглашение отправлено на ${data.email}`)
    reset()
    setDialogOpen(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { userId: deleteTarget.id },
    })
    setDeleting(false)
    const ok = !error && (data as { ok?: boolean } | null)?.ok
    if (!ok) {
      const reason = (data as { reason?: string } | null)?.reason
      toast.error(
        reason === 'has_history'
          ? 'У сотрудника есть история — удалить нельзя. Заблокируйте его.'
          : reason === 'self'
            ? 'Нельзя удалить свой аккаунт'
            : 'Не удалось удалить аккаунт',
      )
      return
    }
    await db.user_profiles.delete(deleteTarget.id)
    toast.success('Аккаунт удалён')
    setDeleteTarget(null)
  }

  async function toggleActive(id: string, currentlyActive: boolean) {
    await db.user_profiles.update(id, { is_active: !currentlyActive })

    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: !currentlyActive })
      .eq('id', id)

    if (error) {
      await db.user_profiles.update(id, { is_active: currentlyActive })
      toast.error('Не удалось обновить статус пользователя')
    }
  }

  return (
    <div className="flex flex-col min-h-full" style={{ background: 'var(--background)' }}>
      <header
        className="flex items-center justify-between px-2"
        style={{
          height: 56,
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1"
          style={{ minWidth: 44, minHeight: 44, color: 'var(--primary)' }}
          aria-label="Назад"
        >
          <ArrowLeft size={20} strokeWidth={1.5} />
          <span className="text-sm font-medium">Назад</span>
        </button>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          Аккаунты
        </h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center justify-center rounded-md"
          style={{ minWidth: 44, minHeight: 44, color: 'var(--primary)' }}
          aria-label="Добавить пользователя"
        >
          <Plus size={22} strokeWidth={1.5} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {profiles?.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-4"
            style={{
              height: 64,
              background: 'var(--card)',
              borderBottom: '1px solid var(--border)',
              opacity: p.is_active ? 1 : 0.5,
            }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {p.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {p.role === 'admin' ? 'администратор' : 'сотрудник'}
                {!p.is_active && ' · заблокирован'}
              </p>
            </div>
            {p.id === currentUserId ? (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>вы</span>
            ) : (
              <div className="flex items-center">
                <button
                  onClick={() => toggleActive(p.id, p.is_active)}
                  className="flex items-center justify-center rounded-md"
                  style={{ minWidth: 44, minHeight: 44 }}
                  aria-label={p.is_active ? 'Заблокировать' : 'Разблокировать'}
                >
                  {p.is_active ? (
                    <UserX size={18} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
                  ) : (
                    <UserCheck size={18} strokeWidth={1.5} style={{ color: 'var(--color-progress)' }} />
                  )}
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                  className="flex items-center justify-center rounded-md"
                  style={{ minWidth: 44, minHeight: 44 }}
                  aria-label="Удалить аккаунт"
                >
                  <Trash2 size={18} strokeWidth={1.5} style={{ color: 'var(--destructive)' }} />
                </button>
              </div>
            )}
          </div>
        ))}

        {profiles?.length === 0 && (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Нет пользователей
            </p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить сотрудника</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onAdd)} className="space-y-4 mt-2" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="name">Имя</Label>
              <Input
                id="name"
                placeholder="Иван"
                {...register('name')}
                style={{ height: 48, borderColor: errors.name ? 'var(--destructive)' : undefined }}
              />
              {errors.name && (
                <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                inputMode="email"
                placeholder="ivan@example.com"
                {...register('email')}
                style={{ height: 48, borderColor: errors.email ? 'var(--destructive)' : undefined }}
              />
              {errors.email && (
                <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Роль</Label>
              <div className="flex gap-2">
                {(['employee', 'admin'] as const).map((r) => (
                  <label
                    key={r}
                    className="flex items-center gap-2 cursor-pointer"
                    style={{ minHeight: 44 }}
                  >
                    <input type="radio" value={r} {...register('role')} />
                    <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                      {r === 'employee' ? 'Сотрудник' : 'Администратор'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="btn-primary w-full"
              disabled={submitting}
              style={{
                height: 52,
              }}
            >
              {submitting ? 'Отправка...' : 'Пригласить'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete account confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent preventOutsideClose>
          <DialogHeader>
            <DialogTitle>Удалить аккаунт «{deleteTarget?.name}»?</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Аккаунт и доступ будут удалены безвозвратно. Если у сотрудника уже есть
            история обходов — удалить нельзя, тогда заблокируйте его.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              className="flex-1 rounded-md font-medium text-base border"
              style={{ height: 48, color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--background)' }}
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Отмена
            </button>
            <button
              className="flex-1 rounded-md font-semibold text-base"
              style={{ height: 52, background: 'var(--destructive)', color: 'var(--destructive-foreground)' }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '…' : 'Удалить'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
