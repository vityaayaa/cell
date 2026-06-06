import { useLiveQuery } from 'dexie-react-hooks'
import { supabase } from '@/data/supabase'
import { db } from '@/data/db'
import { useAppStore } from '@/data/store'
import { useTheme } from './ThemeProvider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

type Theme = 'light' | 'dark' | 'oled'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'oled', label: 'OLED' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsBottomSheet({ open, onClose }: Props) {
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
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--foreground)' }}>Настройки</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Тема
            </p>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  style={{
                    minHeight: 44,
                    flex: 1,
                    borderRadius: 6,
                    border: `1.5px solid ${theme === t.value ? 'var(--primary)' : 'var(--border)'}`,
                    background: theme === t.value ? 'var(--primary)' : 'transparent',
                    color: theme === t.value ? 'var(--primary-foreground)' : 'var(--foreground)',
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

          <Separator />

          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {profile && (
              <div
                className="px-4 py-3"
                style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
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
              style={{ height: 48, background: 'var(--card)', color: 'var(--destructive)' }}
              onClick={handleLogout}
            >
              Выйти из аккаунта
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
