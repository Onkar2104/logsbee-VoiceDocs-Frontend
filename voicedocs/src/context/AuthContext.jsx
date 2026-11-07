import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContext'
import { clearAccessToken, setAccessToken } from '../lib/api'
import { clearLogsbeeAccessToken, loginWithPassword, refreshLogsbeeToken, setLogsbeeAccessToken, verifyLoginOtp } from '../lib/logsbeeApi'
import { fetchCurrentUser } from '../features/current-user/currentUserApi'

const REFRESH_TOKEN_KEY = 'voicedocs_refresh_token'

function saveRefreshToken(token) {
  if (token) window.localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

function clearStoredTokens() {
  clearAccessToken()
  clearLogsbeeAccessToken()
  window.localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const completeAuthentication = useCallback(async (tokens) => {
    if (!tokens?.access_token) throw new Error('The authentication service did not return an access token.')
    setAccessToken(tokens.access_token)
    setLogsbeeAccessToken(tokens.access_token)
    if (tokens.refresh_token) saveRefreshToken(tokens.refresh_token)
    const currentUser = await fetchCurrentUser()
    setUser(currentUser)
    setIsAuthenticated(true)
    return currentUser
  }, [])

  useEffect(() => {
    let cancelled = false
    async function restoreSession() {
      const savedRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY)
      try {
        if (savedRefreshToken) {
          try {
            const tokens = await refreshLogsbeeToken(savedRefreshToken)
            if (!cancelled) await completeAuthentication(tokens)
            return
          } catch (refreshError) {
            // A refresh token may be absent/expired; try the persisted access token once.
            const savedAccessToken = window.localStorage.getItem('voicedocs_access_token')
            if (!savedAccessToken) throw refreshError
            setAccessToken(savedAccessToken)
            setLogsbeeAccessToken(savedAccessToken)
            const currentUser = await fetchCurrentUser()
            if (!cancelled) { setUser(currentUser); setIsAuthenticated(true) }
            return
          }
        }
        const savedAccessToken = window.localStorage.getItem('voicedocs_access_token')
        if (savedAccessToken) {
          setAccessToken(savedAccessToken)
          setLogsbeeAccessToken(savedAccessToken)
          const currentUser = await fetchCurrentUser()
          if (!cancelled) { setUser(currentUser); setIsAuthenticated(true) }
        }
      } catch {
        if (!cancelled) { clearStoredTokens(); setUser(null); setIsAuthenticated(false) }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void restoreSession()
    return () => { cancelled = true }
  }, [completeAuthentication])

  const login = useCallback(async (credentials) => {
    setIsLoading(true)
    try {
      const result = await loginWithPassword(credentials)
      if (result.requires_2fa) return { requires2FA: true, challengeId: result.challenge_id, message: result.message }
      await completeAuthentication(result)
      return { requires2FA: false }
    } finally { setIsLoading(false) }
  }, [completeAuthentication])

  const verifyOtp = useCallback(async ({ challengeId, otp }) => {
    setIsLoading(true)
    try { await completeAuthentication(await verifyLoginOtp({ challengeId, otp })) }
    finally { setIsLoading(false) }
  }, [completeAuthentication])

  const logout = useCallback(() => {
    clearStoredTokens()
    setUser(null)
    setIsAuthenticated(false)
  }, [])

  const value = useMemo(() => ({ user, isAuthenticated, isLoading, login, verifyOtp, logout }), [user, isAuthenticated, isLoading, login, verifyOtp, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}