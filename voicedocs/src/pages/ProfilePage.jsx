import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import WorkspaceSidebar from '../components/WorkspaceSidebar'

function Detail({ label, value }) {
  return <article className="profile-detail-card"><span>{label}</span><strong>{value || 'Not provided'}</strong></article>
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('profile')
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
  const account = user?.account || {}
  const twoFactorEnabled = Boolean(user?.is_2fa_enabled ?? user?.two_factor_enabled)
  return (
    <main className="workspace-with-sidebar">
      <WorkspaceSidebar />
      <section className="workspace-page">
        <header className="workspace-page-heading"><h1>Profile</h1><p>Manage your personal information, organization details and security preferences.</p></header>
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
            <h2 className="profile-section-title">Security & account settings</h2>
            <div className="settings-grid">
              <article className="settings-card"><h3>Two-factor authentication</h3><p>Add an extra verification step when signing in. Your current account status is shown below.</p><div className="setting-control-row"><span className={`setting-status ${twoFactorEnabled ? 'enabled' : ''}`}>{twoFactorEnabled ? 'Enabled' : user?.is_2fa_enabled === false || user?.two_factor_enabled === false ? 'Disabled' : 'Status unavailable'}</span><label className="setting-toggle-label"><input type="checkbox" checked={twoFactorEnabled} disabled aria-label="Two-factor authentication status" /> <span>2FA</span></label></div><p className="setting-helper">The status is read from your account profile. Enable/disable controls require the account security API.</p></article>
              <article className="settings-card"><h3>Password & recovery</h3><p>Change your password, review recovery options and keep your sign-in details secure.</p><span className="setting-status">Managed by Logsbee User</span></article>
              <article className="settings-card"><h3>Active sessions</h3><p>Review signed-in devices and sign out sessions you no longer use.</p><span className="setting-status">Session management API required</span></article>
              <article className="settings-card"><h3>Notifications</h3><p>Future preferences for document shares, edit requests and account security alerts.</p><span className="setting-status">Coming soon</span></article>
              <article className="settings-card"><h3>Connected applications</h3><p>Manage connected services such as Google Drive.</p><span className="setting-status">Manage in Google Drive</span></article>
              <article className="settings-card settings-danger"><h3>Delete organization account</h3><p>Deleting an organization affects all its members and stored documents. This should require Admin confirmation and a recovery window.</p><span className="setting-status">Deletion API and confirmation flow required</span><button className="danger-outline-button" type="button" disabled title="Organization deletion will be enabled after the secure deletion API is implemented">Delete organization</button></article>
            </div>
            <p className="settings-warning">For safety, account deletion and 2FA controls are shown as planned settings, not active buttons. They need dedicated backend endpoints and authorization checks before they can safely change account security or delete data.</p>
          </>
        )}
      </section>
    </main>
  )
}
