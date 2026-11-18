import { useCallback, useEffect, useState } from 'react'
import { FileText, Plus, Search, RefreshCw, Trash2, Clock3, Files, Filter, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { useAuth } from '../context/useAuth'
import { backupDocument, deleteDocument, fetchDocuments, fetchSharingSummary } from '../features/documents/documentsApi'

function getDocumentPreview(content) {
  if (!content?.trim()) return ''
  return content
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<\/(p|h[1-6]|li|div|blockquote|tr)>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDate(value) {
  if (!value) return 'Recently updated'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total_records: 0, has_next: false, has_previous: false })
  const [activeSection, setActiveSection] = useState('my')
  const [sharedByMeCount, setSharedByMeCount] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [legalCategory, setLegalCategory] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [availableFilters, setAvailableFilters] = useState({ legal_categories: [], document_types: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [backingUpDocumentId, setBackingUpDocumentId] = useState(null)

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
  const organizationName = user?.account?.name || 'Your organization'
  const isAccountAdmin = user?.role?.name?.trim().toLowerCase() === 'admin'
  const currentSection = activeSection === 'shared_by_me' && sharedByMeCount === 0 ? 'my' : activeSection

  const loadSharingSummary = useCallback(async () => {
    try {
      const summary = await fetchSharingSummary()
      setSharedByMeCount(Number(summary?.shared_by_me_count || 0))
    } catch {
      setSharedByMeCount(0)
    }
  }, [])

  const loadDocuments = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const result = await fetchDocuments(currentSection, page, 10, { search: debouncedSearch, legalCategory, documentType })
      setDocuments(Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : [])
      setPagination(result?.pagination || { page: 1, total_pages: 1, total_records: Array.isArray(result) ? result.length : 0, has_next: false, has_previous: false })
      setAvailableFilters(result?.filters || { legal_categories: [], document_types: [] })
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not load your documents. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [currentSection, page, debouncedSearch, legalCategory, documentType])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    const startLoading = async () => {
      await Promise.resolve()
      if (!cancelled) await loadDocuments()
    }
    void startLoading()
    return () => { cancelled = true }
  }, [loadDocuments])

  useEffect(() => {
    let cancelled = false
    const startLoading = async () => {
      await Promise.resolve()
      if (!cancelled) await loadSharingSummary()
    }
    void startLoading()
    return () => { cancelled = true }
  }, [loadSharingSummary])

  const visibleDocuments = documents

  async function handleDelete(documentId) {
    if (!window.confirm('Move this document to Trash? You can restore it later. Its Google Drive backups will be removed.')) return
    try {
      const result = await deleteDocument(documentId)
      setDocuments((current) => current.filter((document) => document.id !== documentId))
      if (documents.length === 1 && page > 1) setPage((current) => current - 1)
      else await loadDocuments()
      if (result.drive_cleanup_pending) setError('The document was moved to Trash, but some Google Drive backups could not be removed. Reconnect Google Drive and permanently delete the document from Trash to retry cleanup.')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not delete the document.')
    }
  }

  async function handleBackup(documentId) {
    setBackingUpDocumentId(documentId)
    setError('')
    try {
      const result = await backupDocument(documentId)
      await loadDocuments()
      if (result.audio_pending) {
        setError(`Document backed up, but ${result.audio_pending} audio file(s) still need backup. Try again when Google Drive is available.`)
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Backup failed. The document and audio remain stored in VoiceDocs.')
    } finally {
      setBackingUpDocumentId(null)
    }
  }

  return (
    <main className="dashboard-shell workspace-with-sidebar">
      <WorkspaceSidebar />

      <section className="dashboard-content">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>Good to see you{fullName ? `, ${fullName}` : ''} at {organizationName}.</h1>
            <p className="dashboard-intro">Create, organize and collaborate on your documents.</p>
          </div>
          <button className="primary-button create-button" type="button" onClick={() => navigate('/documents/new')}>
            <Plus size={17} /> New document
          </button>
        </div>



        <section className="documents-section">
          <div className="documents-toolbar">
            <div>
              <p className="eyebrow">DOCUMENT LIBRARY</p>
              <h2>{activeSection === 'my' ? 'My Documents' : activeSection === 'shared' ? 'Shared with Me' : 'Shared by Me'} <span className="document-count">{pagination.total_records}</span></h2>
              <p className="documents-subtitle">Find, filter and manage your workspace documents.</p>
            </div>
            <button className="icon-button documents-refresh" type="button" onClick={() => { loadDocuments(); loadSharingSummary() }} aria-label="Refresh documents" title="Refresh">
              <RefreshCw size={17} />
            </button>
          </div>

          <div className="document-section-switcher" role="tablist" aria-label="Document sections">
            <button
              className={`document-section-tab ${activeSection === 'my' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeSection === 'my'}
              onClick={() => { setActiveSection('my'); setPage(1) }}
            >
              <Files size={18} />
              <span>My Documents</span>
            </button>
            <button
              className={`document-section-tab ${activeSection === 'shared' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeSection === 'shared'}
              onClick={() => { setActiveSection('shared'); setPage(1) }}
            >
              <FileText size={18} />
              <span>Shared with Me</span>
            </button>
            {sharedByMeCount > 0 && (
              <button
                className={`document-section-tab ${activeSection === 'shared_by_me' ? 'active' : ''}`}
                type="button"
                role="tab"
                aria-selected={activeSection === 'shared_by_me'}
                onClick={() => { setActiveSection('shared_by_me'); setPage(1) }}
              >
                <Files size={18} />
                <span>Shared by Me</span>
                <span className="document-count">{sharedByMeCount}</span>
              </button>
            )}
          </div>

          <div className="document-query-panel">
            <div className="document-query-heading">
              <div className="document-query-title">
                <span className="document-query-icon"><Filter size={16} /></span>
                <div>
                  <strong>Search and filters</strong>
                  <span>Search by title or words inside a document</span>
                </div>
              </div>
              {(search || legalCategory || documentType) && (
                <button className="clear-document-filters" type="button" onClick={() => { setSearch(''); setDebouncedSearch(''); setLegalCategory(''); setDocumentType(''); setPage(1) }}>
                  <X size={14} /> Clear all
                </button>
              )}
            </div>
            <div className="document-query-controls">
              <label className="document-search-field">
                <Search size={17} />
                <input aria-label="Search document titles and content" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search by document title or content..." />
                {search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(''); setPage(1) }}><X size={15} /></button>}
              </label>
              <label className="document-filter-field">
                <span>Legal category</span>
                <select value={legalCategory} onChange={(event) => { setLegalCategory(event.target.value); setPage(1) }}>
                  <option value="">All categories</option>
                  {availableFilters.legal_categories.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="document-filter-field">
                <span>Document type</span>
                <select value={documentType} onChange={(event) => { setDocumentType(event.target.value); setPage(1) }}>
                  <option value="">All types</option>
                  {availableFilters.document_types.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            </div>
            <div className="document-query-footer">
              <span>{isLoading ? 'Updating results…' : `${pagination.total_records} ${pagination.total_records === 1 ? 'document' : 'documents'} found`}</span>
              <span>Search applies across all pages</span>
            </div>
          </div>

          {error && <p className="alert alert-error" role="alert">{error}</p>}

          {isLoading ? (
            <div className="documents-state"><RefreshCw className="spin-icon" size={22} /><p>Loading {activeSection === 'my' ? 'your' : activeSection === 'shared' ? 'shared' : 'documents you shared'}…</p></div>
          ) : visibleDocuments.length === 0 ? (
            <div className="documents-empty">
              <span className="empty-icon"><Files size={25} /></span>
              <h3>{search || legalCategory || documentType ? 'No matching documents' : activeSection === 'my' ? 'No documents yet' : activeSection === 'shared' ? 'Nothing shared with you yet' : 'No documents shared by you'}</h3>
              <p>{search || legalCategory || documentType ? 'Try changing your search or filters.' : activeSection === 'my' ? 'Create your first document to get started.' : activeSection === 'shared' ? 'Documents shared with you by your teammates will appear here.' : 'Documents you have shared with teammates will appear here.'}</p>
              {activeSection === 'my' && !search && <button className="primary-button empty-create-button" type="button" onClick={() => navigate('/documents/new')}><Plus size={16} /> Create your first document</button>}
            </div>
          ) : (
            <div className="document-grid">
              {visibleDocuments.map((document) => (
                <article className="document-card" key={document.id}>
                  <div className="document-card-top">
                    <span className="document-icon"><FileText size={20} /></span>
                    {(isAccountAdmin || document.owner_user_id === user?.id) && (
                      <button className="icon-button delete-button" type="button" onClick={() => handleDelete(document.id)} aria-label={`Delete ${document.title}`} title="Delete document">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <Link className="document-open-link" to={`/documents/${document.id}`} aria-label={`Open ${document.title}`}>
                    <h3>{document.title}</h3>
                  </Link>
                  <p className="document-preview">{getDocumentPreview(document.content) || (activeSection === 'my' ? 'No content yet. Open this document to add your notes.' : 'No content yet. Open this document to view it.')}</p>
                  <div className="document-card-footer">
                    <span><Clock3 size={14} /> {formatDate(document.updated_at)}</span>
                    <span>{activeSection === 'my' ? 'Owned by you' : activeSection === 'shared' ? 'Shared with you' : 'Shared by you'}</span>
                  </div>
                  <p className="document-backup-label">
                    {document.backup_status === 'backed_up' && document.audio_backup_status !== 'not_backed_up'
                      ? 'Backed up to Google Drive'
                      : 'Not backed up · Stored in VoiceDocs'}
                  </p>
                  {activeSection === 'my' && (isAccountAdmin || document.owner_user_id === user?.id)
                    && (document.backup_status !== 'backed_up' || document.audio_backup_status === 'not_backed_up') && (
                    <button className="secondary-button" type="button" onClick={() => void handleBackup(document.id)} disabled={backingUpDocumentId === document.id}>
                      {backingUpDocumentId === document.id ? 'Backing up…' : 'Back up to Google Drive'}
                    </button>
                  )}
                  {activeSection === 'shared' && (
                    <p className="shared-by-label">Shared with Me by <strong>{document.shared_by_name || 'A teammate'}</strong></p>
                  )}
                </article>
              ))}
            </div>
          )}

          {!isLoading && pagination.total_pages > 1 && (
            <div className="document-pagination" aria-label="Document pagination">
              <button className="secondary-button" type="button" disabled={!pagination.has_previous} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
              <span>Page {pagination.page} of {pagination.total_pages} · {pagination.total_records} documents</span>
              <button className="secondary-button" type="button" disabled={!pagination.has_next} onClick={() => setPage((current) => current + 1)}>Next</button>
            </div>
          )}

        </section>
      </section>
    </main>
  )
}
