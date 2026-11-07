import { useCallback, useEffect, useState } from 'react'
import { AudioLines, Download, ExternalLink, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { deleteRecording, fetchRecordingContent, fetchRecordings } from '../features/recordings/recordingsApi'

function formatBytes(value) {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`
}

export default function AudioPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const data = await fetchRecordings(); setItems(Array.isArray(data) ? data : []) }
    catch (e) { setError(e.response?.data?.detail || 'Could not load audio. Connect Google Drive to view backed-up recordings.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  async function download(item) {
    setBusy(item.id)
    try {
      const blob = await fetchRecordingContent(item.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = item.file_name || 'recording'; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(e.response?.data?.detail || 'Could not download recording.') }
    finally { setBusy('') }
  }
  async function play(item) {
    setBusy(item.id)
    try { const blob = await fetchRecordingContent(item.id); const url = URL.createObjectURL(blob); const audio = new Audio(url); audio.onended = () => URL.revokeObjectURL(url); await audio.play() }
    catch (e) { setError(e.response?.data?.detail || 'Could not play recording.') }
    finally { setBusy('') }
  }
  async function remove(item) {
    if (!window.confirm(`Delete "${item.file_name}" from Drive?`)) return
    setBusy(item.id)
    try { await deleteRecording(item.id); setItems(current => current.filter(x => x.id !== item.id)) }
    catch (e) { setError(e.response?.data?.detail || 'Could not delete recording.') }
    finally { setBusy('') }
  }
  return (
    <main className="workspace-with-sidebar"><WorkspaceSidebar /><section className="workspace-page">
      <header className="workspace-page-heading"><h1>Audio library</h1><p>Your recordings stored in connected Google Drive.</p></header>
      <div className="audio-library-toolbar"><span>{items.length} recordings</span><button className="icon-button" type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh audio"><RefreshCw size={17}/></button></div>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading ? <div className="documents-state"><LoaderCircle className="spin-icon"/> Loading audio…</div> : items.length === 0 ? (
        <div className="documents-empty"><span className="empty-icon"><AudioLines size={25}/></span><h3>No audio files yet</h3><p>Connect Google Drive and save a recording to see it here.</p><a className="primary-button audio-connect-link" href="/drive">Open Drive settings</a></div>
      ) : <div className="audio-library-list">{items.map(item => <article className="audio-library-row" key={item.id}>
        <span className="recording-file-icon"><AudioLines size={18}/></span>
        <div className="recording-file-details"><strong>{item.file_name}</strong><span>{formatBytes(item.file_size)} · {item.created_at ? new Date(item.created_at).toLocaleString() : 'Date unavailable'}</span></div>
        <div className="recording-actions">
          <button className="icon-button" type="button" onClick={() => void play(item)} disabled={Boolean(busy)} title="Play"><ExternalLink size={16}/></button>
          <button className="icon-button" type="button" onClick={() => void download(item)} disabled={Boolean(busy)} title="Download"><Download size={16}/></button>
          <button className="icon-button recording-delete" type="button" onClick={() => void remove(item)} disabled={Boolean(busy)} title="Delete"><Trash2 size={16}/></button>
          {busy === item.id && <LoaderCircle className="spin-icon" size={15}/>}
        </div>
      </article>)}</div>}
    </section></main>
  )
}
