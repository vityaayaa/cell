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

  const store = useAppStore()

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
        store.clearUser()
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
      store.setUser(data.id, data.role)
      setUserProfile(data)
    }
    setIsLoading(false)
  }

  return { session, userProfile, isLoading }
}
