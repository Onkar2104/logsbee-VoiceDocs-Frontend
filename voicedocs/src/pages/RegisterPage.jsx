import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../lib/api'
import {
  registerAccount,
  resendRegistrationOtp,
  verifyRegistrationEmail,
} from '../lib/logsbeeApi'

const initialForm = {
  organizationName: '',
  organizationEmail: '',
  organizationContact: '',
  organizationAddress: '',
  firstName: '',
  lastName: '',
  adminEmail: '',
  adminContact: '',
  password: '',
  confirmPassword: '',
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [step, setStep] = useState('details')
  const [adminUserId, setAdminUserId] = useState('')
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleRegister(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      const result = await registerAccount({
        name: form.organizationName,
        email: form.organizationEmail || null,
        contact: form.organizationContact || form.adminContact || null,
        address: form.organizationAddress || null,
        admin: {
          first_name: form.firstName,
          last_name: form.lastName,
          email: form.adminEmail,
          password: form.password,
          contact: form.adminContact || null,
        },
      })
      setAdminUserId(result.admin_user_id)
      setMessage(result.message)
      setStep('verify')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVerify(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsLoading(true)
    try {
      await verifyRegistrationEmail(adminUserId, otp)
      setMessage('Email verified. Your organization is active. You can now sign in.')
      setTimeout(() => navigate('/login', { replace: true }), 1200)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    setMessage('')
    setIsLoading(true)
    try {
      const result = await resendRegistrationOtp(form.adminEmail)
      setMessage(result.message)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card register-card">
        <div className="brand-mark" aria-hidden="true">V</div>
        <p className="eyebrow">VOICEDOCS WORKSPACE</p>
        <h1>{step === 'details' ? 'Create your organization' : 'Verify your email'}</h1>
        <p className="auth-description">
          {step === 'details'
            ? 'Register your organization and create its first Admin account.'
            : `Enter the 6-digit code sent to ${form.adminEmail}. Your organization stays inactive until verification is complete.`}
        </p>

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {message && <div className="alert alert-info" role="status">{message}</div>}

        {step === 'details' ? (
          <form className="auth-form register-form" onSubmit={handleRegister}>
            <h2>Organization details</h2>
            <label htmlFor="organizationName">Organization name *</label>
            <input id="organizationName" name="organizationName" value={form.organizationName} onChange={updateField} minLength={2} maxLength={150} required placeholder="Acme Technologies" />
            <label htmlFor="organizationEmail">Organization email</label>
            <input id="organizationEmail" name="organizationEmail" type="email" value={form.organizationEmail} onChange={updateField} placeholder="contact@company.com" />
            <label htmlFor="organizationContact">Organization contact</label>
            <input id="organizationContact" name="organizationContact" value={form.organizationContact} onChange={updateField} maxLength={20} placeholder="+91 98765 43210" />
            <label htmlFor="organizationAddress">Organization address</label>
            <textarea id="organizationAddress" name="organizationAddress" value={form.organizationAddress} onChange={updateField} rows={2} placeholder="City, State, Country" />

            <h2>First Admin account</h2>
            <div className="register-two-column">
              <div><label htmlFor="firstName">First name *</label><input id="firstName" name="firstName" value={form.firstName} onChange={updateField} required maxLength={100} /></div>
              <div><label htmlFor="lastName">Last name *</label><input id="lastName" name="lastName" value={form.lastName} onChange={updateField} required maxLength={100} /></div>
            </div>
            <label htmlFor="adminEmail">Admin email (verification required) *</label>
            <input id="adminEmail" name="adminEmail" type="email" autoComplete="email" value={form.adminEmail} onChange={updateField} required placeholder="you@company.com" />
            <label htmlFor="adminContact">Admin contact</label>
            <input id="adminContact" name="adminContact" value={form.adminContact} onChange={updateField} maxLength={20} placeholder="+91 98765 43210" />
            <label htmlFor="password">Password *</label>
            <input id="password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={updateField} minLength={8} maxLength={128} required />
            <label htmlFor="confirmPassword">Confirm password *</label>
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={updateField} minLength={8} maxLength={128} required />
            <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? 'Creating account…' : 'Create organization account'}</button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleVerify}>
            <label htmlFor="registrationOtp">6-digit verification code</label>
            <input id="registrationOtp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required />
            <button className="primary-button" type="submit" disabled={isLoading || otp.length !== 6}>{isLoading ? 'Verifying…' : 'Verify email and activate account'}</button>
            <button className="text-button" type="button" onClick={handleResend} disabled={isLoading}>Resend verification code</button>
            <button className="text-button" type="button" onClick={() => { setStep('details'); setOtp(''); setError(''); setMessage('') }}>Back to registration</button>
          </form>
        )}

        <p className="auth-signup-link"><Link to="/login">Already have an account? Sign in</Link></p>
        <p className="auth-footnote">Email verification is mandatory before your organization can access VoiceDocs.</p>
      </section>
    </main>
  )
}
