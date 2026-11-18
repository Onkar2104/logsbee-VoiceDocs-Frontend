import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clock3, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { fetchDocumentTrash, permanentlyDeleteDocument, restoreDocument } from '../features/documents/documentsApi'

function formatDate(value) {
  if (!value) return 'Recently deleted'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function TrashPage() {
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total_records: 0, has_next: false, has_previous: false })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadTrash = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchDocumentTrash(page, 10)
      setItems(result.items || [])
      setPagination(result.pagination || { page: 1, total_pages: 1, total_records: 0, has_next: false, has_previous: false })
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not load Trash.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    let cancelled = false
    const startLoading = async () => {
      await Promise.resolve()
      if (!cancelled) await loadTrash()
    }
    void startLoading()
    return () => { cancelled = true }
  }, [loadTrash])

  async function handleRestore(item) {
    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      await restoreDocument(item.id)
      setNotice(`“${item.title}” was restored.`)
      await loadTrash()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not restore this document.')
    } finally {
      setBusyId(null)
    }
  }

  async function handlePermanentDelete(item) {
    if (!window.confirm(`Permanently delete “${item.title}”? This cannot be undone and removes its VoiceDocs data and Google Drive backups.`)) return
    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      await permanentlyDeleteDocument(item.id)
      setNotice(`“${item.title}” was permanently deleted.`)
      if (items.length === 1 && page > 1) setPage((current) => current - 1)
      else await loadTrash()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not permanently delete this document.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="dashboard-shell workspace-with-sidebar">
      <WorkspaceSidebar />
      <section className="dashboard-content">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">DOCUMENT MANAGEMENT</p>
            <h1>Trash</h1>
            <p className="dashboard-intro">Restore deleted documents or permanently remove them.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadTrash()} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <div className="trash-warning">
          <AlertTriangle size={18} />
          <p>Documents in Trash are hidden from the workspace. Google Drive backups are removed when a document is moved here. Permanent deletion cannot be undone.</p>
        </div>

        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {notice && <p className="alert alert-success" role="status">{notice}</p>}

        {loading ? (
          <div className="documents-state"><RefreshCw className="spin-icon" size={22} /><p>Loading Trash…</p></div>
        ) : items.length === 0 ? (
          <div className="documents-empty">
            <span className="empty-icon"><Trash2 size={25} /></span>
            <h3>Trash is empty</h3>
            <p>Documents you delete will appear here until permanently removed.</p>
          </div>
        ) : (
          <div className="trash-list">
            {items.map((item) => (
              <article className="trash-item" key={item.id}>
                <div className="trash-item-icon"><Trash2 size={19} /></div>
                <div className="trash-item-copy">
                  <h3>{item.title}</h3>
                  <span><Clock3 size={13} /> Deleted {formatDate(item.deleted_at)}</span>
                </div>
                <div className="trash-item-actions">
                  <button className="secondary-button" type="button" onClick={() => void handleRestore(item)} disabled={busyId === item.id}>
                    <RotateCcw size={15} /> Restore
                  </button>
                  <button className="danger-button" type="button" onClick={() => void handlePermanentDelete(item)} disabled={busyId === item.id}>
                    <Trash2 size={15} /> Delete permanently
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && pagination.total_pages > 1 && (
          <div className="document-pagination" aria-label="Trash pagination">
            <button className="secondary-button" type="button" disabled={!pagination.has_previous} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            <span>Page {pagination.page} of {pagination.total_pages} · {pagination.total_records} documents</span>
            <button className="secondary-button" type="button" disabled={!pagination.has_next} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        )}
      </section>
    </main>
  )
}
