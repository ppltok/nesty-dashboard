import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface DashboardAccess {
  email: string
  display_name: string | null
  role: 'admin' | 'viewer'
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  access: DashboardAccess | null
  loading: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [access, setAccess] = useState<DashboardAccess | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check dashboard access for a given email
  async function checkAccess(email: string): Promise<DashboardAccess | null> {
    const { data, error: fetchError } = await supabase
      .from('dashboard_access')
      .select('email, display_name, role')
      .eq('email', email)
      .single()

    if (fetchError || !data) return null
    return data as DashboardAccess
  }

  // Initialize: check existing session
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return
      if (s?.user) {
        setUser(s.user)
        setSession(s)
        try {
          const accessData = await checkAccess(s.user.email ?? '')
          if (!mounted) return
          if (accessData) {
            setAccess(accessData)
            setError(null)
          } else {
            setError('unauthorized')
          }
        } catch {
          if (mounted) setError('unauthorized')
        }
      }
      if (mounted) setLoading(false)
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    // Safety timeout — never stay loading forever
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 5000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s)
        setUser(s?.user ?? null)

        if (s?.user) {
          const accessData = await checkAccess(s.user.email ?? '')
          if (accessData) {
            setAccess(accessData)
            setError(null)
          } else {
            setError('unauthorized')
          }
        } else {
          setAccess(null)
          setError(null)
        }
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function signInWithGoogle() {
    setError(null)
    const redirectTo = window.location.origin + '/'
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (signInError) {
      setError(signInError.message)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setAccess(null)
    setError(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, session, access, loading, error, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
