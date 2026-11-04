import { useCallback, useEffect, useState } from 'react'
import { Cloud, CloudDownload, ExternalLink, HardDrive, LoaderCircle, RefreshCw, Trash2, Unplug } from 'lucide-react'
import {
  connectGoogleDrive,
  deleteRecording,
  disconnectGoogleDrive,
  fetchGoogleDriveStatus,
  fetchRecordingContent,
  fetchRecordings,
} from '../features/recordings/recordingsApi'

function formatBytes(value) {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Date unavailable'
}

export default function GoogleDrivePanel() {
  const [status, setStatus] = useState({ connected: false, google_email: null })
  const [recordings, setRecordings] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [playingUrl, setPlayingUrl] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const connection = await fetchGoogleDriveStatus()
      setStatus(connection)
      if (connection.connected) {
        const items = await fetchRecordings()
        setRecordings(Array.isArray(items) ? items : [])
      } else {
        setRecordings([])
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not load Google Drive recordings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      try {
        const connection = await fetchGoogleDriveStatus()
        if (cancelled) return
        setStatus(connection)
        if (connection.connected) {
          const items = await fetchRecordings()
          if (!cancelled) setRecordings(Array.isArray(items) ? items : [])
        } else {
          setRecordings([])
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.response?.data?.detail || 'Could not load Google Drive recordings.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const params = new URLSearchParams(window.location.search)
    if (params.has('google_drive')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    void initialize()
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => {
    if (playingUrl) URL.revokeObjectURL(playingUrl)
  }, [playingUrl])

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
      setRecordings([])
      if (playingUrl) URL.revokeObjectURL(playingUrl)
      setPlayingUrl('')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not disconnect Google Drive.')
    } finally {
      setBusy('')
    }
  }

  async function handlePlay(item) {
    setBusy(item.id)
    setError('')
    try {
      const blob = await fetchRecordingContent(item.id)
      const url = URL.createObjectURL(blob)
      if (playingUrl) URL.revokeObjectURL(playingUrl)
      setPlayingUrl(url)
      const audio = new Audio(url)
      await audio.play()
      audio.onended = () => URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not play this recording.')
    } finally {
      setBusy('')
    }
  }

  async function handleDownload(item) {
    setBusy(item.id)
    try {
      const blob = await fetchRecordingContent(item.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = item.file_name || 'recording'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not download this recording.')
    } finally {
      setBusy('')
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.file_name}" from Google Drive?`)) return
    setBusy(item.id)
    try {
      await deleteRecording(item.id)
      setRecordings((current) => current.filter((recording) => recording.id !== item.id))
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not delete this recording.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="drive-panel">
      <div className="drive-panel-heading">
        <div className="drive-panel-title">
          <span className="drive-panel-icon"><HardDrive size={19} /></span>
          <div><p className="card-label">AUDIO BACKUP</p><h2>Google Drive recordings</h2></div>
        </div>
        <button className="icon-button" type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh recordings" title="Refresh">
          {loading ? <LoaderCircle className="spin-icon" size={17} /> : <RefreshCw size={17} />}
        </button>
      </div>

      <div className="drive-connection-row">
        <div>
          <strong>{status.connected ? 'Google Drive connected' : 'Connect your Google Drive'}</strong>
          <p>{status.connected ? status.google_email : 'Recorded audio can be backed up to your personal Drive.'}</p>
        </div>
        {status.connected ? (
          <button className="secondary-button" type="button" onClick={handleDisconnect} disabled={Boolean(busy)}>
            <Unplug size={15} /> {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <button className="primary-button drive-connect-button" type="button" onClick={handleConnect} disabled={Boolean(busy)}>
            <Cloud size={16} /> {busy === 'connect' ? 'Connecting…' : 'Connect Google Drive'}
          </button>
        )}
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {status.connected && (
        <div className="recordings-list">
          <div className="recordings-list-heading"><strong>Your saved recordings</strong><span>{recordings.length} files</span></div>
          {loading ? <p className="drive-muted">Loading recordings…</p> : recordings.length === 0 ? (
            <p className="drive-muted">No saved recordings yet. New microphone recordings will appear here after transcription and Drive upload are enabled.</p>
          ) : recordings.map((item) => (
            <article className="recording-row" key={item.id}>
              <div className="recording-file-icon"><Cloud size={17} /></div>
              <div className="recording-file-details">
                <strong>{item.file_name}</strong>
                <span>{formatBytes(item.file_size)} · {formatDate(item.created_at)}{item.language ? ` · ${item.language.toUpperCase()}` : ''}</span>
              </div>
              <div className="recording-actions">
                <button className="icon-button" type="button" onClick={() => handlePlay(item)} disabled={Boolean(busy)} title="Play recording" aria-label={`Play ${item.file_name}`}>
                  {busy === item.id ? <LoaderCircle className="spin-icon" size={16} /> : <ExternalLink size={16} />}
                </button>
                <button className="icon-button" type="button" onClick={() => handleDownload(item)} disabled={Boolean(busy)} title="Download recording" aria-label={`Download ${item.file_name}`}><CloudDownload size={16} /></button>
                <button className="icon-button recording-delete" type="button" onClick={() => handleDelete(item)} disabled={Boolean(busy)} title="Delete recording" aria-label={`Delete ${item.file_name}`}><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
