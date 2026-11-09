import { LoaderCircle } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <main className="auth-session-loading" role="status" aria-live="polite">
        <LoaderCircle className="spin-icon" size={26} />
        <span>Restoring your session…</span>
      </main>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />
}