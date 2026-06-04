import { useNavigate } from 'react-router'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/data/supabase'
import { useAppStore } from '@/data/store'
import { useTheme } from '@/app/ThemeProvider'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'

type Theme = 'light' | 'dark' | 'oled'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'oled', label: 'OLED' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { userId, clearUser } = useAppStore()
  const profile = useLiveQuery(
    () => (userId ? db.user_profiles.get(userId) : undefined),
    [userId],
  )

  async function handleLogout() {
    await supabase.auth.signOut()
    clearUser()
    toast.success('Вы вышли из аккаунта')
  }

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ background: 'var(--background)' }}
    >
      <header
        className="flex items-center px-2"
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
        <h1
          className="text-base font-semibold ml-2"
          style={{ color: 'var(--foreground)' }}
        >
          Настройки
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <nav className="mt-2">
          <button
            onClick={() => navigate('/app/settings/users')}
            className="flex items-center justify-between w-full px-4"
            style={{
              height: 56,
              background: 'var(--card)',
              borderBottom: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          >
            <span className="text-sm">Аккаунты</span>
            <ChevronRight size={18} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
          </button>
          <button
            onClick={() => navigate('/app/settings/audit')}
            className="flex items-center justify-between w-full px-4"
            style={{
              height: 56,
              background: 'var(--card)',
              color: 'var(--foreground)',
            }}
          >
            <span className="text-sm">Журнал действий</span>
            <ChevronRight size={18} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </nav>

        <Separator className="my-4" />

        <div className="px-4">
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Тема
          </p>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                style={{
                  minHeight: 44,
                  borderRadius: 6,
                  border: `1.5px solid ${theme === t.value ? 'var(--primary)' : 'var(--border)'}`,
                  background: theme === t.value ? 'var(--primary)' : 'transparent',
                  color: theme === t.value ? 'var(--primary-foreground)' : 'var(--foreground)',
                  padding: '0 16px',
                  fontSize: 14,
                  fontWeight: theme === t.value ? 600 : 400,
                  transition: 'all 150ms',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Separator className="my-4" />

        <div className="px-4 pb-6 space-y-3">
          {profile && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {profile.name} · {profile.role === 'admin' ? 'администратор' : 'сотрудник'}
            </p>
          )}
          <Button
            variant="destructive"
            className="w-full"
            style={{ height: 48 }}
            onClick={handleLogout}
          >
            Выйти из аккаунта
          </Button>
        </div>
      </div>
    </div>
  )
}
