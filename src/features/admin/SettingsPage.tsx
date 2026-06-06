import { useNavigate } from 'react-router'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/data/supabase'
import { useAppStore } from '@/data/store'
import { useTheme } from '@/app/ThemeProvider'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'

type Theme = 'light' | 'dark' | 'oled'

const THEMES: { value: Theme; label: string; emoji: string }[] = [
  { value: 'light', label: 'Светлая', emoji: '☀️' },
  { value: 'dark', label: 'Тёмная', emoji: '🌙' },
  { value: 'oled', label: 'OLED', emoji: '⬛' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const userId = useAppStore((s) => s.userId)
  const clearUser = useAppStore((s) => s.clearUser)
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
        className="flex items-center px-2 flex-shrink-0"
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

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Navigation items */}
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
              borderBottom: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          >
            <span className="text-sm">Журнал действий</span>
            <ChevronRight size={18} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </nav>

        {/* Theme */}
        <div className="px-4 mt-6 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Тема
          </p>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl"
                style={{
                  height: 72,
                  border: `2px solid ${theme === t.value ? 'var(--primary)' : 'var(--border)'}`,
                  background: theme === t.value ? 'var(--primary)' : 'var(--card)',
                  color: theme === t.value ? 'var(--primary-foreground)' : 'var(--foreground)',
                  transition: 'all 150ms',
                }}
              >
                <span className="text-xl">{t.emoji}</span>
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        {/* Profile + logout — always at bottom */}
        <div
          className="mx-4 mb-6 rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {profile && (
            <div
              className="px-4 py-4"
              style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {profile.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {profile.role === 'admin' ? 'Администратор' : 'Сотрудник'}
              </p>
            </div>
          )}
          <button
            className="w-full flex items-center justify-center font-semibold text-sm"
            style={{
              height: 52,
              background: 'var(--card)',
              color: 'var(--destructive)',
            }}
            onClick={handleLogout}
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  )
}
