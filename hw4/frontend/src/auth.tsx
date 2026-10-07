import { useEffect, useState, type ReactNode } from 'react'
import type { User } from './api'
import { clearRecentlyViewed } from './recentlyViewed'
import { AuthContext } from './useAuth'

// Keeps the logged-in user (never the password) in memory and localStorage,
// so a page refresh doesn't log the shopper out.
const STORAGE_KEY = 'campus-customs-user'

function parseUser(saved: string | null): User | null {
  try {
    return saved ? (JSON.parse(saved) as User) : null
  } catch {
    return null
  }
}

function loadUser(): User | null {
  return parseUser(localStorage.getItem(STORAGE_KEY))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(loadUser)

  // Keep every open tab in sync: logging in or out in one tab applies to the others.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY || e.key === null) setUserState(parseUser(localStorage.getItem(STORAGE_KEY)))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function setUser(next: User) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setUserState(next)
  }

  // Logging out removes everything this browser kept about the shopper. Page state
  // that depends on the user (chat, page search results, welcome back) resets when
  // `user` becomes null.
  function logout() {
    if (user) clearRecentlyViewed(user.id)
    localStorage.removeItem(STORAGE_KEY)
    setUserState(null)
  }

  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>
}
