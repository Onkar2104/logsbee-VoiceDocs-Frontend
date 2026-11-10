import { useEffect, useState } from 'react'
import { Save, Settings } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { fetchUserPreferences, updateUserPreferences } from '../features/current-user/preferencesApi'
import { requestAccountTwoFactorOtp, verifyAccountTwoFactorOtp, disableAccountTwoFactor } from '../lib/logsbeeApi'
import { SUPPORTED_LANGUAGES } from '../features/current-user/languages'

function Detail({ label, value }) {
  return <article className="profile-detail-card"><span>{label}</span><strong>{value || 'Not provided'}</strong></article>
}

export default function ProfilePage() {
  const { user } = useAuth()
 
  const [tab, setTab] = useState('profile')
  const [language, setLanguage] = useState('en')
  const [automaticBackup, setAutomaticBackup] = useState(true)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorOtp, setTwoFactorOtp] = useState('')
  const [twoFactorStep, setTwoFactorStep] = useState('idle')
  const [twoFactorBusy, setTwoFactorBusy] = useState(false)
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true)
  const [isSavingPreferences, setIsSavingPreferences] = useState(false)
  const [preferencesError, setPreferencesError] = useState('')
  const [preferencesNotice, setPreferencesNotice] = useState('')

  useEffect(() => {
    let active = true
    fetchUserPreferences()
      .then((preferences) => {
        if (active) {
          setLanguage(preferences.default_language || preferences.transcription_language || 'en')
          setAutomaticBackup(preferences.automatic_backup_enabled !== false)
          setTwoFactorEnabled(Boolean(user?.is_two_factor_authenticated))
        }
      })
      .catch((requestError) => {
        if (active) setPreferencesError(requestError.response?.data?.detail || 'Could not load your default language.')
      })
      .finally(() => { if (active) setIsLoadingPreferences(false) })
    return () => { active = false }
  }, [user?.is_two_factor_authenticated])

  async function handleSaveLanguage(event) {
    event.preventDefault()
    setIsSavingPreferences(true)
    setPreferencesError('')
    setPreferencesNotice('')
    try {
      const updated = await updateUserPreferences({ default_language: language, automatic_backup_enabled: automaticBackup })
      setLanguage(updated.default_language || updated.transcription_language || language)
      setAutomaticBackup(updated.automatic_backup_enabled !== false)
      setPreferencesNotice('Your settings have been saved.')
    } catch (requestError) {
      setPreferencesError(requestError.response?.data?.detail || 'Could not save your default language.')
    } finally {
      setIsSavingPreferences(false)
    }
  }

  async function handleRequestTwoFactorOtp() {
    setTwoFactorBusy(true)
    setPreferencesError('')
    setPreferencesNotice('')
    try {
      await requestAccountTwoFactorOtp()
      setTwoFactorStep('verify')
      setPreferencesNotice('A six-digit verification code has been sent to your registered email.')
    } catch (requestError) {
      setPreferencesError(requestError.response?.data?.detail || 'Could not send the verification code.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  async function handleVerifyTwoFactorOtp(event) {
    event.preventDefault()
    setTwoFactorBusy(true)
    setPreferencesError('')
    setPreferencesNotice('')
    try {
      await verifyAccountTwoFactorOtp(twoFactorOtp)
      setTwoFactorEnabled(true)
      setTwoFactorOtp('')
      setTwoFactorStep('idle')
      setPreferencesNotice('Two-factor authentication is now enabled.')
    } catch (requestError) {
      setPreferencesError(requestError.response?.data?.detail || 'Could not verify the code.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  async function handleDisableTwoFactor() {
    setTwoFactorBusy(true)
    setPreferencesError('')
    setPreferencesNotice('')
    try {
      await disableAccountTwoFactor()
      setTwoFactorEnabled(false)
      setTwoFactorStep('idle')
      setPreferencesNotice('Two-factor authentication has been disabled.')
    } catch (requestError) {
      setPreferencesError(requestError.response?.data?.detail || 'Could not disable two-factor authentication.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
  const account = user?.account || {}
  return (
    <main className="workspace-with-sidebar">
      <WorkspaceSidebar />
      <section className="workspace-page">
        <header className="workspace-page-heading"><h1>Profile &amp; Settings</h1><p>Manage your personal information, organization details, language, security and backup preferences.</p></header>
        <div className="profile-tabs" role="tablist" aria-label="Profile sections">
          <button type="button" role="tab" aria-selected={tab === 'profile'} className={`profile-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>Personal details</button>
          <button type="button" role="tab" aria-selected={tab === 'settings'} className={`profile-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}><Settings size={14} /> Settings</button>
        </div>
        {tab === 'profile' ? (
          <>
            <h2 className="profile-section-title">Your details</h2>
            <div className="profile-details-grid">
              <Detail label="Full name" value={fullName} />
              <Detail label="Email address" value={user?.email} />
              <Detail label="Contact number" value={user?.contact} />
              <Detail label="Role" value={user?.role?.name} />
              <Detail label="Email verification" value={user?.is_email_verified ? 'Verified' : 'Not verified'} />
              <Detail label="Contact verification" value={user?.is_contact_verified ? 'Verified' : 'Not verified'} />
            </div>
            <h2 className="profile-section-title organization-section-title">Organization details</h2>
            <div className="profile-details-grid">
              <Detail label="Organization" value={account.name} />
              <Detail label="Organization email" value={account.email} />
              <Detail label="Organization contact" value={account.contact} />
              <Detail label="Address" value={account.address} />
            </div>
          </>
        ) : (
          <>
            <h2 className="profile-section-title">Speech and dictation</h2>
            <form className="settings-card profile-language-settings" onSubmit={handleSaveLanguage}>
              <h3>Default transcription language</h3>
              <p>This language is selected automatically when you open a document. Changing the language inside a document only affects that document session.</p>
              <label htmlFor="profile-default-transcription-language">Default language</label>
              <select id="profile-default-transcription-language" value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isLoadingPreferences || isSavingPreferences}>
                {SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              {preferencesError && <p className="alert alert-error" role="alert">{preferencesError}</p>}
              {preferencesNotice && <p className="alert alert-success" role="status">{preferencesNotice}</p>}
              <div className="settings-actions">
                <button className="primary-button save-button" type="submit" disabled={isLoadingPreferences || isSavingPreferences}>
                  <Save size={16} /> {isSavingPreferences ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </form>
            <h2 className="profile-section-title">Storage & backup</h2>
            <article className="settings-card">
              <h3>Automatic Google Drive backup</h3>
              <p>When enabled, new documents and audio are uploaded automatically when Drive is connected. Pending files are retried when you reconnect or return online. When disabled, files stay in VoiceDocs until you choose manual backup.</p>
              <div className="setting-control-row">
                <span className={`setting-status ${automaticBackup ? 'enabled' : ''}`}>{automaticBackup ? 'Automatic backup on' : 'Manual backup only'}</span>
                <label className="setting-toggle-label"><input type="checkbox" checked={automaticBackup} onChange={(event) => setAutomaticBackup(event.target.checked)} disabled={isLoadingPreferences || isSavingPreferences} aria-label="Enable automatic Google Drive backup" /> <span>Automatic backup</span></label>
              </div>
            </article>
            <h2 className="profile-section-title">Security & account settings</h2>
            <div className="settings-grid">
              <article className="settings-card">
                <h3>Two-factor authentication</h3>
                <p>Require a one-time code sent to your registered Logsbee email address after password sign-in.</p>
                <div className="setting-control-row"><span className={`setting-status ${twoFactorEnabled ? 'enabled' : ''}`}>{twoFactorEnabled ? 'Enabled' : 'Disabled'}</span></div>
                {twoFactorEnabled ? (
                  <button className="secondary-button" type="button" onClick={handleDisableTwoFactor} disabled={twoFactorBusy}>{twoFactorBusy ? 'Updating…' : 'Disable 2FA'}</button>
                ) : twoFactorStep === 'verify' ? (
                  <form onSubmit={handleVerifyTwoFactorOtp}>
                    <label htmlFor="two-factor-otp">Email verification code</label>
                    <input id="two-factor-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={twoFactorOtp} onChange={(event) => setTwoFactorOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
                    <div className="settings-actions"><button className="primary-button save-button" type="submit" disabled={twoFactorBusy || twoFactorOtp.length !== 6}>{twoFactorBusy ? 'Verifying…' : 'Verify and enable'}</button><button className="secondary-button" type="button" onClick={() => setTwoFactorStep('idle')} disabled={twoFactorBusy}>Cancel</button></div>
                  </form>
                ) : (
                  <button className="primary-button" type="button" onClick={handleRequestTwoFactorOtp} disabled={twoFactorBusy || !user?.is_email_verified}>{twoFactorBusy ? 'Sending…' : 'Enable 2FA with email OTP'}</button>
                )}
                {!user?.is_email_verified && <p className="settings-warning">Verify your email in Logsbee before enabling 2FA.</p>}
              </article>
              <article className="settings-card"><h3>Password & recovery</h3><p>Change your password, review recovery options and keep your sign-in details secure.</p><span className="setting-status">Managed by Logsbee User</span></article>
              <article className="settings-card"><h3>Active sessions</h3><p>Review signed-in devices and sign out sessions you no longer use.</p><span className="setting-status">Session management API required</span></article>
              <article className="settings-card"><h3>Notifications</h3><p>Future preferences for document shares, edit requests and account security alerts.</p><span className="setting-status">Coming soon</span></article>
              <article className="settings-card"><h3>Connected applications</h3><p>Manage connected services such as Google Drive.</p><span className="setting-status">Manage in Google Drive</span></article>
              <article className="settings-card settings-danger"><h3>Delete organization account</h3><p>Deleting an organization affects all its members and stored documents. This should require Admin confirmation and a recovery window.</p><span className="setting-status">Deletion API and confirmation flow required</span><button className="danger-outline-button" type="button" disabled title="Organization deletion will be enabled after the secure deletion API is implemented">Delete organization</button></article>
            </div>
            <p className="settings-warning">2FA activation and deactivation are handled by Logsbee. Activation requires a verified email and a successful one-time code.</p>
          </>
        )}
      </section>
    </main>
  )
}
