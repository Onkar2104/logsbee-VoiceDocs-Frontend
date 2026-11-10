import { useCallback, useEffect, useState } from 'react'
import { Cloud, HardDrive, LoaderCircle, RefreshCw, Unplug } from 'lucide-react'
import { connectGoogleDrive, disconnectGoogleDrive, fetchGoogleDriveStatus, backupPendingFiles } from '../features/recordings/recordingsApi'
import { fetchUserPreferences } from '../features/current-user/preferencesApi'

export default function GoogleDrivePanel() {
  const [status, setStatus] = useState({ connected: false, google_email: null })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [backupResult, setBackupResult] = useState(null)
  const [backupBusy, setBackupBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const connection = await fetchGoogleDriveStatus()
      setStatus(connection)
      if (connection.connected && navigator.onLine) {
        const preferences = await fetchUserPreferences()
        if (preferences.automatic_backup_enabled) {
          setBackupBusy(true)
          try {
            const result = await backupPendingFiles()
            setBackupResult(result)
          } finally {
            setBackupBusy(false)
          }
        }
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not load Google Drive status.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('google_drive')) window.history.replaceState({}, '', window.location.pathname)
    Promise.resolve().then(load)
  }, [load])

  async function handleConnect() {
    setBusy('connect')
    setError('')
    try {
      const result = await connectGoogleDrive()
      window.location.assign(result.authorization_url)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not start Google Drive connection.')
      setBusy('')
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Disconnect Google Drive? Existing files will remain in your Google Drive.')) return
    setBusy('disconnect')
    try {
      await disconnectGoogleDrive()
      setStatus({ connected: false, google_email: null })
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not disconnect Google Drive.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="drive-panel">
      <div className="drive-panel-heading">
        <div className="drive-panel-title"><span className="drive-panel-icon"><HardDrive size={19} /></span><div><p className="card-label">GOOGLE DRIVE</p><h2>Google Drive connection</h2></div></div>
        <button className="icon-button" type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh Google Drive status" title="Refresh">{loading ? <LoaderCircle className="spin-icon" size={17} /> : <RefreshCw size={17} />}</button>
      </div>
      <div className="drive-connection-row">
        <div><strong>{status.connected ? 'Google Drive connected' : 'Connect your Google Drive'}</strong><p>{status.connected ? status.google_email : 'Connect your account to back up audio recordings.'}</p></div>
        {status.connected ? (
          <button className="secondary-button" type="button" onClick={handleDisconnect} disabled={Boolean(busy)}><Unplug size={15} /> {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}</button>
        ) : (
          <button className="primary-button drive-connect-button" type="button" onClick={handleConnect} disabled={Boolean(busy)}><Cloud size={16} /> {busy === 'connect' ? 'Connecting…' : 'Connect Google Drive'}</button>
        )}
      </div>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {backupBusy && <p className="drive-muted">Checking pending files and backing them up to Google Drive…</p>}
      {backupResult && backupResult.total > 0 && (
        <div className="drive-backup-results" aria-live="polite">
          <strong>Backup results: {backupResult.backed_up} of {backupResult.total} files</strong>
          {backupResult.items.map((item) => (
            <div className="drive-backup-result-row" key={`${item.type}-${item.id}`}>
              <span>{item.type === 'document' ? 'Document' : 'Audio'} · {item.id.slice(0, 8)}</span>
              <span className={item.status === 'backed_up' ? 'backup-status-done' : 'backup-status-pending'}>{item.status === 'backed_up' ? `${item.progress}% complete` : `Failed · ${item.error || 'Retry later'}`}</span>
            </div>
          ))}
        </div>
      )}
      <p className="drive-muted">Audio files are available in the Audio tab. Database copies are cleared only after a successful Drive backup.</p>
    </section>
  )
}