import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, verifyOtp, isLoading } = useAuth()
  const [step, setStep] = useState('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    try {
      const result = await login({ email, password })
      if (result.requires2FA) {
        setChallengeId(result.challengeId)
        setMessage(result.message || 'A verification code has been sent to your registered email.')
        setStep('otp')
      } else {
        navigate('/', { replace: true })
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }

  async function handleOtpSubmit(event) {
    event.preventDefault()
    setError('')

    try {
      await verifyOtp({ challengeId, otp })
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark" aria-hidden="true">V</div>
        <p className="eyebrow">VOICEDOCS WORKSPACE</p>
        <h1>{step === 'password' ? 'Welcome back' : 'Verify your identity'}</h1>
        <p className="auth-description">
          {step === 'password'
            ? 'Sign in with your Logsbee account to access your documents.'
            : `Enter the verification code sent to the registered email for ${email}.`}
        </p>

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {message && <div className="alert alert-info" role="status">{message}</div>}

        {step === 'password' ? (
          <form className="auth-form" onSubmit={handlePasswordSubmit}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
            />

            <div className="field-heading">
              <label htmlFor="password">Password</label>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />

            <button className="primary-button" type="submit" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleOtpSubmit}>
            <label htmlFor="otp">6-digit verification code</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
            />
            <button className="primary-button" type="submit" disabled={isLoading || otp.length !== 6}>
              {isLoading ? 'Verifying…' : 'Verify and continue'}
            </button>
            <button className="text-button" type="button" onClick={() => {
              setStep('password')
              setOtp('')
              setChallengeId('')
              setMessage('')
              setError('')
            }}>
              Back to sign in
            </button>
          </form>
        )}
        <p className="auth-footnote">Authentication is managed securely by Logsbee User Management.</p>
      </section>
    </main>
  )
}
