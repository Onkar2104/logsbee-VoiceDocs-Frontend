import { useAuth } from '../context/useAuth'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ')

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <a className="dashboard-brand" href="/" aria-label="VoiceDocs home">
          <span className="brand-mark brand-mark-small">V</span>
          <span>VoiceDocs</span>
        </a>
        <button className="secondary-button" type="button" onClick={logout}>Sign out</button>
      </header>

      <section className="dashboard-content">
        <p className="eyebrow">YOUR WORKSPACE</p>
        <h1>Good to see you{fullName ? `, ${fullName}` : ''}.</h1>
        <p className="dashboard-intro">You are signed in. Your VoiceDocs workspace is connected to Logsbee.</p>

        <article className="profile-card">
          <div>
            <p className="card-label">SIGNED IN AS</p>
            <h2>{fullName || user?.email}</h2>
            <p className="muted-text">{user?.email}</p>
          </div>
          <div className="profile-details">
            <div><span>Role</span><strong>{user?.role?.name || '—'}</strong></div>
            <div><span>Account</span><strong>{user?.account?.name || '—'}</strong></div>
            <div><span>Email verified</span><strong>{user?.is_email_verified ? 'Yes' : 'No'}</strong></div>
          </div>
        </article>

        <section className="next-phase-card">
          <p className="eyebrow">NEXT UP</p>
          <h2>Your documents will appear here</h2>
          <p className="muted-text">The next frontend step is connecting the document list, editor, and sharing workflows to the VoiceDocs API.</p>
        </section>
      </section>
    </main>
  )
}
