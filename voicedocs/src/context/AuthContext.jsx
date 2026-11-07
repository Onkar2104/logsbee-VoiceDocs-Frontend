import { useCallback, useMemo, useState } from 'react'
import { AuthContext } from './authContext'
import { loginWithPassword, verifyLoginOtp, setLogsbeeAccessToken, clearLogsbeeAccessToken } from '../lib/logsbeeApi'
import { fetchCurrentUser } from '../features/current-user/currentUserApi'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const completeAuthentication = useCallback(async (tokens) => {
    if (!tokens?.access_token) {
      throw new Error('The authentication service did not return an access token.')
    }

    // The access token is issued by Logsbee User, so attach it to that API client.
    setLogsbeeAccessToken(tokens.access_token)
    try {
      const currentUser = await fetchCurrentUser()
      setUser(currentUser)
      setIsAuthenticated(true)
      return currentUser
    } catch (error) {
      clearLogsbeeAccessToken()
      setUser(null)
      setIsAuthenticated(false)
      throw error
    }
  }, [])

  const login = useCallback(async (credentials) => {
    setIsLoading(true)
    try {
      const result = await loginWithPassword(credentials)
      if (result.requires_2fa) {
        return {
          requires2FA: true,
          challengeId: result.challenge_id,
          message: result.message,
        }
      }
      await completeAuthentication(result)
      return { requires2FA: false }
    } finally {
      setIsLoading(false)
    }
  }, [completeAuthentication])

  const verifyOtp = useCallback(async ({ challengeId, otp }) => {
    setIsLoading(true)
    try {
      const tokens = await verifyLoginOtp({ challengeId, otp })
      await completeAuthentication(tokens)
    } finally {
      setIsLoading(false)
    }
  }, [completeAuthentication])

  const logout = useCallback(() => {
    clearLogsbeeAccessToken()
    setUser(null)
    setIsAuthenticated(false)
  }, [])

  const value = useMemo(() => ({
    user, isAuthenticated, isLoading, login, verifyOtp, logout,
  }), [user, isAuthenticated, isLoading, login, verifyOtp, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
