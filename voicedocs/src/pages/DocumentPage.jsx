import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Clock3, FileText, Save, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import VoiceDictation from '../components/VoiceDictation'
import { deleteDocument, fetchDocument, requestDocumentEditAccess, updateDocument } from '../features/documents/documentsApi'

function formatDate(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function DocumentPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [document, setDocument] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isRequestingAccess, setIsRequestingAccess] = useState(false)
  const contentTextareaRef = useRef(null)

  const isAccountAdmin = user?.role?.name?.trim().toLowerCase() === 'admin'
  const canManage = Boolean(document && (isAccountAdmin || document.owner_user_id === user?.id))

  const loadDocument = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const result = await fetchDocument(documentId)
      setDocument(result)
      setTitle(result.title || '')
      setContent(result.content || '')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not load this document.')
    } finally {
      setIsLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    let cancelled = false
    const startLoading = async () => {
      await Promise.resolve()
      if (!cancelled) await loadDocument()
    }
    void startLoading()
    return () => { cancelled = true }
  }, [loadDocument])

  function handleTranscriptInsert(transcript) {
    const textarea = contentTextareaRef.current
    const start = textarea?.selectionStart ?? content.length
    const end = textarea?.selectionEnd ?? content.length
    const prefix = start > 0 && !/\s$/.test(content.slice(0, start)) ? ' ' : ''
    const suffix = end < content.length && !/^\s/.test(content.slice(end)) ? ' ' : ''
    const insertion = `${prefix}${transcript.trim()}${suffix}`
    const nextContent = content.slice(0, start) + insertion + content.slice(end)
    setContent(nextContent)
    setNotice('Transcription inserted. Save your document to keep the changes.')
    requestAnimationFrame(() => {
      if (!contentTextareaRef.current) return
      const cursor = start + insertion.length
      contentTextareaRef.current.focus()
      contentTextareaRef.current.setSelectionRange(cursor, cursor)
    })
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Document title cannot be empty.')
      return
    }
    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      const updated = await updateDocument(documentId, { title: title.trim(), content })
      setDocument(updated)
      setTitle(updated.title)
      setContent(updated.content)
      setNotice('Your changes have been saved.')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not save your changes.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRequestEditAccess() {
    setIsRequestingAccess(true)
    setError('')
    setNotice('')
    try {
      const result = await requestDocumentEditAccess(documentId)
      setNotice(result.edit_request_status === 'pending' ? 'Your edit access request has been sent to the document owner.' : 'Your edit access request was submitted.')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not request edit access.')
    } finally {
      setIsRequestingAccess(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete this document?')) return
    try {
      await deleteDocument(documentId)
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not delete this document.')
    }
  }

  if (isLoading) {
    return <main className="document-page-shell"><div className="documents-state">Loading document…</div></main>
  }

  if (error && !document) {
    return (
      <main className="document-page-shell">
        <div className="document-editor-card">
          <p className="alert alert-error" role="alert">{error}</p>
          <Link className="back-link" to="/"><ArrowLeft size={16} /> Back to documents</Link>
        </div>
      </main>
    )
  }

  if (!document) return null

  return (
    <main className="document-page-shell">
      <header className="document-page-header">
        <Link className="dashboard-brand" to="/">
          <span className="brand-mark brand-mark-small">V</span><span>VoiceDocs</span>
        </Link>
        <Link className="back-link" to="/"><ArrowLeft size={16} /> All documents</Link>
      </header>

      <section className="document-page-content">
        <div className="document-page-meta">
          <div className="document-title-icon"><FileText size={21} /></div>
          <div><p className="eyebrow">DOCUMENT WORKSPACE</p><h1>{document.title}</h1></div>
        </div>
        <div className="document-editor-card">
          <div className="editor-toolbar">
            <span className="document-updated"><Clock3 size={14} /> Last updated {formatDate(document.updated_at)}</span>
            {canManage && (
              <button className="icon-button delete-button" type="button" onClick={handleDelete} title="Delete document" aria-label="Delete document">
                <Trash2 size={17} />
              </button>
            )}
          </div>
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          {notice && <p className="alert alert-success" role="status">{notice}</p>}
          {canManage ? (
            <form onSubmit={handleSave} className="document-editor-form">
              <label htmlFor="edit-document-title">Document title</label>
              <input id="edit-document-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} />
              <label htmlFor="edit-document-content">Content</label>
              <VoiceDictation onTranscript={handleTranscriptInsert} />
              <textarea ref={contentTextareaRef} id="edit-document-content" value={content} onChange={(event) => setContent(event.target.value)} rows={18} placeholder="Write your document here..." />
              <div className="editor-actions">
                <span className="editor-hint">Changes are saved to your VoiceDocs workspace.</span>
                <button className="primary-button save-button" type="submit" disabled={isSaving}><Save size={16} /> {isSaving ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          ) : (
            <div className="document-readonly">
              <div className="readonly-notice">You have view access to this document. Request edit access from its owner if you need to make changes.</div>
              <div className="readonly-actions"><button className="primary-button save-button" type="button" onClick={handleRequestEditAccess} disabled={isRequestingAccess}>{isRequestingAccess ? 'Sending request…' : 'Request edit access'}</button></div>
              <h2>{document.title}</h2>
              <p>{document.content || 'This document is empty.'}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
