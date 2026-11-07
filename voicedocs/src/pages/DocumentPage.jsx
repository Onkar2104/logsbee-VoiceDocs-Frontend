import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Clock3, FileText, Save, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import VoiceDictation from '../components/VoiceDictation'
import RichTextEditor from '../components/RichTextEditor'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { createDocument, deleteDocument, fetchDocument, requestDocumentEditAccess, updateDocument } from '../features/documents/documentsApi'

function formatDate(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function DocumentPage() {
  const { documentId } = useParams()
  const isNewDocument = documentId === 'new'
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
  // A newly opened draft belongs to the current user and must be editable
  // before it has a persisted owner_user_id from the API.
  const canManage = Boolean(isNewDocument || (document && (isAccountAdmin || document.owner_user_id === user?.id)))

  const loadDocument = useCallback(async () => {
    if (isNewDocument) {
      setDocument({ id: 'new', title: '', content: '', updated_at: null, owner_user_id: user?.id })
      setTitle('')
      setContent('')
      setIsLoading(false)
      return
    }
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
  }, [documentId, isNewDocument, user?.id])

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
    const editor = contentTextareaRef.current
    if (!editor) return
    editor.chain().focus().insertContent(transcript.trim()).run()
    setNotice('Transcription inserted. Save your document to keep the changes.')
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
      const updated = isNewDocument
        ? await createDocument({ title: title.trim(), content })
        : await updateDocument(documentId, { title: title.trim(), content })
      setDocument(updated)
      setTitle(updated.title)
      setContent(updated.content)
      setNotice(isNewDocument ? 'Your document has been created.' : 'Your changes have been saved.')
      if (isNewDocument) navigate(`/documents/${updated.id}`, { replace: true })
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
    return (
      <main className="document-page-shell workspace-with-sidebar">
        <WorkspaceSidebar />
        <section className="document-page-content"><div className="documents-state">Loading document…</div></section>
      </main>
    )
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

  if (!document) {
    return (
      <main className="document-page-shell workspace-with-sidebar">
        <WorkspaceSidebar />
        <section className="document-page-content">
          <div className="document-editor-card"><p className="alert alert-error">The document could not be opened. Please return to your documents and try again.</p><Link className="back-link" to="/documents"><ArrowLeft size={16} /> Back to documents</Link></div>
        </section>
      </main>
    )
  }

  return (
    <main className="document-page-shell workspace-with-sidebar">
      <WorkspaceSidebar />

      <section className="document-page-content">
        <div className="document-page-meta">
          <div className="document-title-icon"><FileText size={21} /></div>
          <div><p className="eyebrow">DOCUMENT WORKSPACE</p><h1>{isNewDocument ? 'Untitled document' : document.title}</h1></div>
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
              <label htmlFor="edit-document-title">Document title <span className="required-label">*</span></label>
              <input id="edit-document-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} required placeholder="Enter a document title" />
              <label htmlFor="edit-document-content">Content</label>
              <VoiceDictation onTranscript={handleTranscriptInsert} />
              <RichTextEditor editorRef={contentTextareaRef} value={content} onChange={setContent} />
              <div className="editor-actions">
                <span className="editor-hint">{isNewDocument ? 'A title is required to create this document.' : 'Changes are saved to your VoiceDocs workspace.'}</span>
                <button className="primary-button save-button" type="submit" disabled={isSaving || !title.trim()}><Save size={16} /> {isSaving ? 'Saving…' : isNewDocument ? 'Create document' : 'Save changes'}</button>
              </div>
            </form>
          ) : (
            <div className="document-readonly">
              <div className="readonly-notice">You have view access to this document. Request edit access from its owner if you need to make changes.</div>
              <div className="readonly-actions"><button className="primary-button save-button" type="button" onClick={handleRequestEditAccess} disabled={isRequestingAccess}>{isRequestingAccess ? 'Sending request…' : 'Request edit access'}</button></div>
              <h2>{document.title}</h2>
              <RichTextEditor value={document.content || ''} editable={false} />
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
