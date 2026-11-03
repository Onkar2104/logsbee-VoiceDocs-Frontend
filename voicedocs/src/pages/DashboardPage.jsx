import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Plus, Search, RefreshCw, Trash2, Clock3, Files } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { createDocument, deleteDocument, fetchDocuments, fetchSharingSummary } from '../features/documents/documentsApi'

function formatDate(value) {
  if (!value) return 'Recently updated'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const [documents, setDocuments] = useState([])
  const [activeSection, setActiveSection] = useState('my')
  const [sharedByMeCount, setSharedByMeCount] = useState(0)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
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
      const result = await fetchDocuments(currentSection)
      setDocuments(Array.isArray(result) ? result : [])
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not load your documents. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [currentSection])

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

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase()
    return documents.filter((document) => {
      const belongsInSection = activeSection === 'my'
        ? document.owner_user_id === user?.id
        : currentSection === 'shared'
          ? Boolean(document.shared_by_user_id)
          : true
      return belongsInSection && (!query || document.title?.toLowerCase().includes(query))
    })
  }, [documents, search, user?.id, currentSection])

  async function handleCreate(event) {
    event.preventDefault()
    if (!title.trim()) {
      setFormError('Please enter a document title.')
      return
    }

    setIsSaving(true)
    setFormError('')
    try {
      const created = await createDocument({ title: title.trim(), content })
      if (activeSection === 'my') setDocuments((current) => [created, ...current])
      setTitle('')
      setContent('')
      setIsCreating(false)
    } catch (requestError) {
      setFormError(requestError.response?.data?.detail || 'Could not create the document. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(documentId) {
    if (!window.confirm('Move this document to the deleted state?')) return
    try {
      await deleteDocument(documentId)
      setDocuments((current) => current.filter((document) => document.id !== documentId))
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not delete the document.')
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <a className="dashboard-brand" href="/" aria-label="VoiceDocs home">
          <span className="brand-mark brand-mark-small">V</span>
          <span>VoiceDocs</span>
        </a>
        <div className="header-actions">
          <span className="header-user">{fullName || user?.email}</span>
          <button className="secondary-button" type="button" onClick={logout}>Sign out</button>
        </div>
      </header>

      <section className="dashboard-content">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>Good to see you{fullName ? `, ${fullName}` : ''}.</h1>
            <p className="dashboard-intro">Create, organize and collaborate on your documents.</p>
          </div>
          <button className="primary-button create-button" type="button" onClick={() => { setIsCreating(true); setFormError('') }}>
            <Plus size={17} /> New document
          </button>
        </div>

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

        {isCreating && (
          <form className="document-form-card" onSubmit={handleCreate}>
            <div className="section-heading">
              <div><p className="card-label">NEW DOCUMENT</p><h2>Create a document</h2></div>
              <button className="text-button" type="button" onClick={() => setIsCreating(false)}>Cancel</button>
            </div>
            {formError && <p className="alert alert-error" role="alert">{formError}</p>}
            <label htmlFor="document-title">Title</label>
            <input id="document-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} placeholder="e.g. Project proposal" autoFocus />
            <label htmlFor="document-content">Content <span className="optional-label">Optional</span></label>
            <textarea id="document-content" value={content} onChange={(event) => setContent(event.target.value)} rows={5} placeholder="Start writing your document..." />
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setIsCreating(false)}>Cancel</button>
              <button className="primary-button save-button" type="submit" disabled={isSaving}>{isSaving ? 'Creating…' : 'Create document'}</button>
            </div>
          </form>
        )}

        <section className="documents-section">
          <div className="documents-toolbar">
            <div>
              <p className="eyebrow">DOCUMENT LIBRARY</p>
              <h2>{activeSection === 'my' ? 'My Documents' : activeSection === 'shared' ? 'Shared with Me' : 'Shared by Me'} <span className="document-count">{visibleDocuments.length}</span></h2>
            </div>
            <div className="document-tools">
              <label className="search-field">
                <Search size={17} />
                <input aria-label="Search documents" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" />
              </label>
              <button className="icon-button" type="button" onClick={() => { loadDocuments(); loadSharingSummary() }} aria-label="Refresh documents" title="Refresh">
                <RefreshCw size={17} />
              </button>
            </div>
          </div>

          <div className="document-section-switcher" role="tablist" aria-label="Document sections">
            <button
              className={`document-section-tab ${activeSection === 'my' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeSection === 'my'}
              onClick={() => setActiveSection('my')}
            >
              <Files size={18} />
              <span>My Documents</span>
            </button>
            <button
              className={`document-section-tab ${activeSection === 'shared' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeSection === 'shared'}
              onClick={() => setActiveSection('shared')}
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
                onClick={() => setActiveSection('shared_by_me')}
              >
                <Files size={18} />
                <span>Shared by Me</span>
                <span className="document-count">{sharedByMeCount}</span>
              </button>
            )}
          </div>

          {error && <p className="alert alert-error" role="alert">{error}</p>}

          {isLoading ? (
            <div className="documents-state"><RefreshCw className="spin-icon" size={22} /><p>Loading {activeSection === 'my' ? 'your' : activeSection === 'shared' ? 'shared' : 'documents you shared'}…</p></div>
          ) : visibleDocuments.length === 0 ? (
            <div className="documents-empty">
              <span className="empty-icon"><Files size={25} /></span>
              <h3>{search ? 'No matching documents' : activeSection === 'my' ? 'No documents yet' : activeSection === 'shared' ? 'Nothing shared with you yet' : 'No documents shared by you'}</h3>
              <p>{search ? 'Try a different search term.' : activeSection === 'my' ? 'Create your first document to get started.' : activeSection === 'shared' ? 'Documents shared with you by your teammates will appear here.' : 'Documents you have shared with teammates will appear here.'}</p>
              {activeSection === 'my' && !search && <button className="primary-button empty-create-button" type="button" onClick={() => setIsCreating(true)}><Plus size={16} /> Create your first document</button>}
            </div>
          ) : (
            <div className="document-grid">
              {visibleDocuments.map((document) => (
                <article className="document-card" key={document.id}>
                  <div className="document-card-top">
                    <span className="document-icon"><FileText size={20} /></span>
                    {activeSection === 'my' && (isAccountAdmin || document.owner_user_id === user?.id) && (
                      <button className="icon-button delete-button" type="button" onClick={() => handleDelete(document.id)} aria-label={`Delete ${document.title}`} title="Delete document">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <Link className="document-open-link" to={`/documents/${document.id}`} aria-label={`Open ${document.title}`}>
                    <h3>{document.title}</h3>
                  </Link>
                  <p className="document-preview">{document.content?.trim() || (activeSection === 'my' ? 'No content yet. Open this document to add your notes.' : 'No content yet. Open this document to view it.')}</p>
                  <div className="document-card-footer">
                    <span><Clock3 size={14} /> {formatDate(document.updated_at)}</span>
                    <span>{activeSection === 'my' ? 'Owned by you' : activeSection === 'shared' ? 'Shared with you' : 'Shared by you'}</span>
                  </div>
                  {activeSection === 'shared' && (
                    <p className="shared-by-label">Shared with Me by <strong>{document.shared_by_name || 'A teammate'}</strong></p>
                  )}
                </article>
              ))}
            </div>
          )}

        </section>
      </section>
    </main>
  )
}
