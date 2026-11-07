import { useCallback, useEffect, useState } from 'react'
import { Cloud, HardDrive, LoaderCircle, RefreshCw, Unplug } from 'lucide-react'
import { connectGoogleDrive, disconnectGoogleDrive, fetchGoogleDriveStatus } from '../features/recordings/recordingsApi'

export default function GoogleDrivePanel() {
  const [status, setStatus] = useState({ connected: false, google_email: null })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const connection = await fetchGoogleDriveStatus()
      setStatus(connection)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not load Google Drive status.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('google_drive')) window.history.replaceState({}, '', window.location.pathname)
    void load()
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
      <p className="drive-muted">Saved audio files are available only in the Audio tab.</p>
    </section>
  )
}