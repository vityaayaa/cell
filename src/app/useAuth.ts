import { useEffect, useState } from 'react'
import type { Session as AuthSession } from '@supabase/supabase-js'
import { supabase } from '@/data/supabase'
import { db } from '@/data/db'
import type { UserProfile } from '@/data/db'
import { useAppStore } from '@/data/store'

export function useAuth(): {
  session: AuthSession | null
  userProfile: UserProfile | null
  isLoading: boolean
} {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const setUser = useAppStore((s) => s.setUser)
  const clearUser = useAppStore((s) => s.clearUser)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s) {
        loadProfile(s.user.id)
      } else {
        setIsLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) {
        loadProfile(s.user.id)
      } else {
        clearUser()
        setUserProfile(null)
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) {
      await db.user_profiles.put(data)
      setUser(data.id, data.role)
      setUserProfile(data)
    } else {
      // Офлайн/ошибка сети: сетевой запрос пуст → восстанавливаем профиль (и роль)
      // из Dexie-кэша прошлой сессии, иначе роль не проставится и приложение
      // будет вести себя как без прав.
      const cached = await db.user_profiles.get(userId)
      if (cached) {
        setUser(cached.id, cached.role)
        setUserProfile(cached)
      }
    }
    setIsLoading(false)
  }

  return { session, userProfile, isLoading }
}
