import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, AudioLines, Clock3, FileText, RefreshCw, RotateCcw, Trash2, Layers3 } from 'lucide-react'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import {
  fetchDocumentTrash, permanentlyDeleteDocument, restoreDocument,
  fetchAllDeletedDocumentVersions, restoreDocumentVersion, permanentlyDeleteDocumentVersion,
} from '../features/documents/documentsApi'
import { fetchAudioTrash, restoreRecording, permanentlyDeleteRecording } from '../features/recordings/recordingsApi'

const SECTIONS = [
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'audio', label: 'Audio', icon: AudioLines },
  { id: 'versions', label: 'Version Trash', icon: Layers3 },
]

function formatDate(value) {
  if (!value) return 'Recently deleted'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function retentionLabel(item) {
  if (item.days_remaining != null) return `${Math.max(0, item.days_remaining)} days left`
  if (item.expires_at) {
    const days = Math.max(0, Math.ceil((new Date(item.expires_at).getTime() - Date.now()) / 86400000))
    return `${days} days left`
  }
  return 'Auto-delete after 30 days'
}

export default function TrashPage() {
  const [section, setSection] = useState('documents')
  const [documents, setDocuments] = useState([])
  const [audio, setAudio] = useState([])
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadTrash = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [docsResult, audioResult, versionsResult] = await Promise.all([
        fetchDocumentTrash(1, 100),
        fetchAudioTrash(1, 100),
        fetchAllDeletedDocumentVersions(),
      ])
      setDocuments(docsResult.items || [])
      setAudio(audioResult.items || [])
      setVersions(versionsResult.items || [])
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not load all Trash sections.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) return loadTrash()
      return undefined
    })
    return () => { cancelled = true }
  }, [loadTrash])

  async function runAction(id, action, successMessage) {
    setBusyId(id)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(successMessage)
      await loadTrash()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'The requested Trash action failed.')
    } finally {
      setBusyId(null)
    }
  }

  function confirmPermanent(label, type) {
    return window.confirm(`Permanently delete ${type} “${label}”? All VoiceDocs data and associated Google Drive files will be erased. This cannot be undone.`)
  }

  const items = section === 'documents' ? documents : section === 'audio' ? audio : versions
  const emptyCopy = section === 'documents' ? 'Deleted documents will appear here.' : section === 'audio' ? 'Deleted audio recordings will appear here.' : 'Deleted formatted versions will appear here.'

  return (
    <main className="dashboard-shell workspace-with-sidebar">
      <WorkspaceSidebar />
      <section className="dashboard-content">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">WORKSPACE MANAGEMENT</p>
            <h1>Trash</h1>
            <p className="dashboard-intro">Restore items within 30 days or permanently erase them.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadTrash()} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <div className="trash-warning">
          <AlertTriangle size={18} />
          <p>Documents, audio, and versions are automatically and permanently deleted 30 days after being moved to Trash. Permanent deletion also removes associated Google Drive backups.</p>
        </div>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {notice && <p className="alert alert-success" role="status">{notice}</p>}

        <div className="trash-section-tabs" role="tablist" aria-label="Trash categories">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={section === id}
              className={`trash-section-tab ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>
              <Icon size={16} /> {label}
              <span>{id === 'documents' ? documents.length : id === 'audio' ? audio.length : versions.length}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="documents-state"><RefreshCw className="spin-icon" size={22} /><p>Loading Trash…</p></div>
        ) : items.length === 0 ? (
          <div className="documents-empty">
            <span className="empty-icon"><Trash2 size={25} /></span>
            <h3>{section === 'documents' ? 'No deleted documents' : section === 'audio' ? 'No deleted audio' : 'No deleted versions'}</h3>
            <p>{emptyCopy}</p>
          </div>
        ) : (
          <div className="trash-list">
            {items.map((item) => {
              const id = item.id
              const label = section === 'documents' ? item.title : section === 'audio' ? item.file_name : `Formatted version ${item.version_number}`
              return (
                <article className="trash-item" key={id}>
                  <div className="trash-item-icon">{section === 'documents' ? <FileText size={19} /> : section === 'audio' ? <AudioLines size={19} /> : <Layers3 size={19} />}</div>
                  <div className="trash-item-copy">
                    <h3>{label}</h3>
                    {section === 'versions' && <span>{item.document_title || 'Document'} · {item.document_id}</span>}
                    <span><Clock3 size={13} /> Deleted {formatDate(item.deleted_at)}</span>
                    <span className="trash-retention">{retentionLabel(item)}</span>
                    {item.drive_cleanup_pending && <span className="trash-drive-pending">Google Drive cleanup pending — retry permanent deletion after reconnecting Drive</span>}
                  </div>
                  <div className="trash-item-actions">
                    <button className="secondary-button" type="button" disabled={busyId === id}
                      onClick={() => void runAction(id, () => section === 'documents' ? restoreDocument(id) : section === 'audio' ? restoreRecording(id) : restoreDocumentVersion(item.document_id, id), `“${label}” was restored.`)}>
                      <RotateCcw size={15} /> Restore
                    </button>
                    <button className="danger-button" type="button" disabled={busyId === id}
                      onClick={() => {
                        if (!confirmPermanent(label, section === 'audio' ? 'audio recording' : section === 'versions' ? 'formatted version' : 'document')) return
                        void runAction(id, () => section === 'documents' ? permanentlyDeleteDocument(id) : section === 'audio' ? permanentlyDeleteRecording(id) : permanentlyDeleteDocumentVersion(item.document_id, id), `“${label}” was permanently deleted.`)
                      }}>
                      <Trash2 size={15} /> Delete permanently
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
