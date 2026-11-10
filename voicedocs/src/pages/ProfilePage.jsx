import { useEffect, useState } from 'react'
import { Save, Settings } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { fetchUserPreferences, updateUserPreferences } from '../features/current-user/preferencesApi'
import { fetchCurrentUser } from '../features/current-user/currentUserApi'
import { requestAccountTwoFactorOtp, verifyAccountTwoFactorOtp, disableAccountTwoFactor } from '../lib/logsbeeApi'
import { SUPPORTED_LANGUAGES } from '../features/current-user/languages'

function Detail({ label, value }) {
  return <article className="profile-detail-card"><span>{label}</span><strong>{value || 'Not provided'}</strong></article>
}

export default function ProfilePage() {
  const { user } = useAuth()
 
  const [accountUser, setAccountUser] = useState(user)
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
  const [backupError, setBackupError] = useState('')
  const [backupNotice, setBackupNotice] = useState('')
  const [isSavingBackup, setIsSavingBackup] = useState(false)
  const [securityError, setSecurityError] = useState('')
  const [securityNotice, setSecurityNotice] = useState('')
  const [isLoadingAccount, setIsLoadingAccount] = useState(true)

  useEffect(() => {
    let active = true
    fetchCurrentUser()
      .then((freshUser) => {
        if (!active) return
        setAccountUser(freshUser)
        setTwoFactorEnabled(Boolean(freshUser.is_two_factor_authenticated))
      })
      .catch(() => { if (active) setAccountUser(user) })
      .finally(() => { if (active) setIsLoadingAccount(false) })
    fetchUserPreferences()
      .then((preferences) => {
        if (active) {
          setLanguage(preferences.default_language || preferences.transcription_language || 'en')
          setAutomaticBackup(preferences.automatic_backup_enabled !== false)
        }
      })
      .catch((requestError) => {
        if (active) setPreferencesError(requestError.response?.data?.detail || 'Could not load your default language.')
      })
      .finally(() => { if (active) setIsLoadingPreferences(false) })
    return () => { active = false }
  }, [user])

  async function handleSaveLanguage(event) {
    event.preventDefault()
    setIsSavingPreferences(true)
    setPreferencesError('')
    setPreferencesNotice('')
    try {
      const updated = await updateUserPreferences({ default_language: language })
      setLanguage(updated.default_language || updated.transcription_language || language)
      setPreferencesNotice('Your default language has been saved.')
    } catch (requestError) {
      setPreferencesError(requestError.response?.data?.detail || 'Could not save your default language.')
    } finally {
      setIsSavingPreferences(false)
    }
  }


  async function handleSaveBackup(event) {
    event.preventDefault()
    setIsSavingBackup(true)
    setBackupError('')
    setBackupNotice('')
    try {
      const updated = await updateUserPreferences({ automatic_backup_enabled: automaticBackup })
      setAutomaticBackup(updated.automatic_backup_enabled !== false)
      setBackupNotice('Your Google Drive backup preference has been saved.')
    } catch (requestError) {
      setBackupError(requestError.response?.data?.detail || 'Could not save your Google Drive backup preference.')
    } finally {
      setIsSavingBackup(false)
    }
  }

  async function refreshAccountSecurity() {
    const freshUser = await fetchCurrentUser()
    setAccountUser(freshUser)
    setTwoFactorEnabled(Boolean(freshUser.is_two_factor_authenticated))
  }

  async function handleRequestTwoFactorOtp() {
    setTwoFactorBusy(true)
    setSecurityError('')
    setSecurityNotice('')
    try {
      await requestAccountTwoFactorOtp()
      setTwoFactorStep('verify')
      setSecurityNotice('A six-digit verification code has been sent to your registered email.')
    } catch (requestError) {
      setSecurityError(requestError.response?.data?.detail || 'Could not send the verification code.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  async function handleVerifyTwoFactorOtp(event) {
    event.preventDefault()
    setTwoFactorBusy(true)
    setSecurityError('')
    setSecurityNotice('')
    try {
      await verifyAccountTwoFactorOtp(twoFactorOtp)
      await refreshAccountSecurity()
      setTwoFactorOtp('')
      setTwoFactorStep('idle')
      setSecurityNotice('Two-factor authentication is now enabled.')
    } catch (requestError) {
      setSecurityError(requestError.response?.data?.detail || 'Could not verify the code.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  async function handleDisableTwoFactor() {
    setTwoFactorBusy(true)
    setSecurityError('')
    setSecurityNotice('')
    try {
      await disableAccountTwoFactor()
      await refreshAccountSecurity()
      setTwoFactorStep('idle')
      setSecurityNotice('Two-factor authentication has been disabled.')
    } catch (requestError) {
      setSecurityError(requestError.response?.data?.detail || 'Could not disable two-factor authentication.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const profileUser = accountUser || user
  const fullName = [profileUser?.first_name, profileUser?.last_name].filter(Boolean).join(' ')
  const account = profileUser?.account || {}
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
              <Detail label="Email address" value={profileUser?.email} />
              <Detail label="Contact number" value={profileUser?.contact} />
              <Detail label="Role" value={profileUser?.role?.name} />
              <Detail label="Email verification" value={profileUser?.is_email_verified ? 'Verified' : 'Not verified'} />
              <Detail label="Contact verification" value={profileUser?.is_contact_verified ? 'Verified' : 'Not verified'} />
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
              <div className="speech-settings-intro">
                <span className="speech-settings-icon"><Settings size={19} /></span>
                <div><h3>Personalize voice input</h3><p>Choose the language VoiceDocs should select automatically whenever you create or open a document.</p></div>
              </div>
              <label htmlFor="profile-default-transcription-language">Your default language</label>
              <select id="profile-default-transcription-language" value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isLoadingPreferences || isSavingPreferences}>
                {SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <div className="speech-settings-note"><strong>Good to know</strong><span>You can change the language at any time inside a document. That temporary choice will not overwrite your saved default.</span></div>
              {preferencesError && <p className="alert alert-error" role="alert">{preferencesError}</p>}
              {preferencesNotice && <p className="alert alert-success" role="status">{preferencesNotice}</p>}
              <div className="settings-actions">
                <button className="primary-button save-button" type="submit" disabled={isLoadingPreferences || isSavingPreferences}>
                  <Save size={16} /> {isSavingPreferences ? 'Saving preferences…' : 'Save preferences'}
                </button>
              </div>
            </form>
            <h2 className="profile-section-title">Google Drive &amp; backup</h2>
            <form className="settings-card profile-language-settings" onSubmit={handleSaveBackup}>
              <div className="speech-settings-intro"><span className="speech-settings-icon"><Settings size={19} /></span><div><h3>Automatic backup</h3><p>Keep your documents and audio backed up to your connected Google Drive.</p></div></div>
              <div className="speech-backup-option">
                <div><strong>Automatic Google Drive backup</strong><span>When enabled, pending files retry when you connect Drive, reopen VoiceDocs or return online. When disabled, you can back up each file manually.</span></div>
                <label className="setting-toggle-label"><input type="checkbox" checked={automaticBackup} onChange={(event) => setAutomaticBackup(event.target.checked)} disabled={isLoadingPreferences || isSavingBackup} aria-label="Enable automatic Google Drive backup" /><span>{automaticBackup ? 'On' : 'Off'}</span></label>
              </div>
              {!automaticBackup && <p className="speech-settings-note">Automatic backup is off. Your files remain in VoiceDocs until you choose manual backup.</p>}
              {backupError && <p className="alert alert-error" role="alert">{backupError}</p>}
              {backupNotice && <p className="alert alert-success" role="status">{backupNotice}</p>}
              <div className="settings-actions"><button className="primary-button save-button" type="submit" disabled={isLoadingPreferences || isSavingBackup}><Save size={16} /> {isSavingBackup ? 'Saving backup setting…' : 'Save backup setting'}</button></div>
            </form>
            <h2 className="profile-section-title">Security & account settings</h2>
            <div className="settings-grid">
              <article className="settings-card">
                <h3>Two-factor authentication</h3>
                <p>Require a one-time code sent to your registered Logsbee email address after password sign-in.</p>
                <div className="setting-control-row two-factor-toggle-row">
                  <span className={`setting-status ${twoFactorEnabled ? 'enabled' : ''}`}>{isLoadingAccount ? 'Checking status…' : twoFactorEnabled ? 'Enabled' : twoFactorStep === 'verify' ? 'Verification pending' : 'Disabled'}</span>
                  <label className="two-factor-switch" aria-label="Enable or disable two-factor authentication">
                    <input
                      type="checkbox"
                      checked={twoFactorEnabled}
                      disabled={twoFactorBusy || isLoadingAccount || (!profileUser?.is_email_verified && !twoFactorEnabled)}
                      onChange={(event) => event.target.checked ? handleRequestTwoFactorOtp() : handleDisableTwoFactor()}
                    />
                    <span className="two-factor-switch-track" />
                  </label>
                </div>
                {twoFactorStep === 'verify' && !twoFactorEnabled && (
                  <form className="two-factor-verify-form" onSubmit={handleVerifyTwoFactorOtp}>
                    <label htmlFor="two-factor-otp">Enter the six-digit code sent to your email</label>
                    <input id="two-factor-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={twoFactorOtp} onChange={(event) => setTwoFactorOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
                    <div className="settings-actions"><button className="primary-button save-button" type="submit" disabled={twoFactorBusy || twoFactorOtp.length !== 6}>{twoFactorBusy ? 'Verifying…' : 'Verify and enable'}</button><button className="secondary-button" type="button" onClick={() => { setTwoFactorStep('idle'); setTwoFactorOtp('') }} disabled={twoFactorBusy}>Cancel</button></div>
                  </form>
                )}
                {securityError && <p className="alert alert-error" role="alert">{securityError}</p>}
                {securityNotice && <p className="alert alert-success" role="status">{securityNotice}</p>}
                {!profileUser?.is_email_verified && <p className="settings-warning">Verify your Logsbee email address before enabling 2FA.</p>}
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
