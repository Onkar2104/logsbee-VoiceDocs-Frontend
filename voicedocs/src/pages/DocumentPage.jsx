import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Clock3, Download, FileText, Save, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import VoiceDictation from '../components/VoiceDictation'
import RichTextEditor from '../components/RichTextEditor'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { downloadDocumentPdf, downloadDocumentWord } from '../features/documents/documentExport'
import { createDocument, deleteDocument, fetchDocument, requestDocumentEditAccess, updateDocument } from '../features/documents/documentsApi'
import { fetchUserPreferences } from '../features/current-user/preferencesApi'

function formatDate(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function DocumentPage() {
  const { documentId } = useParams()
  // /documents/new is currently matched by a static route, so documentId can be undefined.
  const isNewDocument = !documentId || documentId === 'new'
  const navigate = useNavigate()
  const { user } = useAuth()
  const [document, setDocument] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [defaultLanguage, setDefaultLanguage] = useState('en')
  const [transcriptionProvider, setTranscriptionProvider] = useState('whisper')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isRequestingAccess, setIsRequestingAccess] = useState(false)
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false)
  const [downloadFormat, setDownloadFormat] = useState('')
  const contentTextareaRef = useRef(null)

  const isAccountAdmin = user?.role?.name?.trim().toLowerCase() === 'admin'
  // A newly opened draft belongs to the current user and must be editable
  // before it has a persisted owner_user_id from the API.
  const canManage = Boolean(isNewDocument || (document && (isAccountAdmin || document.owner_user_id === user?.id)))

  const loadDocument = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      try {
        const preferences = await fetchUserPreferences()
        setDefaultLanguage(preferences.transcription_language || 'en')
        setTranscriptionProvider(preferences.transcription_provider || 'whisper')
      } catch (preferencesError) {
        // A preferences endpoint/migration issue must not prevent document access.
        console.warn('Could not load speech preferences; using defaults.', preferencesError)
        setDefaultLanguage('en')
        setTranscriptionProvider('whisper')
      }

      if (isNewDocument) {
        setDocument({ id: 'new', title: '', content: '', updated_at: null, owner_user_id: user?.id })
        setTitle('')
        setContent('')
        return
      }

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

  async function handleDownload(format) {
    setDownloadFormat(format)
    setError('')
    setNotice('')
    try {
      const exportTitle = canManage ? title : document.title
      const exportContent = canManage ? content : document.content
      if (format === 'pdf') {
        await downloadDocumentPdf(exportTitle, exportContent)
      } else {
        await downloadDocumentWord(exportTitle, exportContent)
      }
      setNotice(`Your document was exported as ${format === 'pdf' ? 'PDF' : 'Word'}.`)
    } catch (downloadError) {
      console.error('Document export failed:', downloadError)
      setError('Could not generate the download. Please try again.')
    } finally {
      setDownloadFormat('')
      setIsDownloadMenuOpen(false)
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
            <div className="document-toolbar-actions">
              <div className="document-download-wrap">
                <button
                  className="secondary-button document-download-button"
                  type="button"
                  onClick={() => setIsDownloadMenuOpen((open) => !open)}
                  aria-expanded={isDownloadMenuOpen}
                  aria-haspopup="menu"
                  disabled={Boolean(downloadFormat)}
                >
                  <Download size={16} /> {downloadFormat ? 'Preparing…' : 'Download'}
                </button>
                {isDownloadMenuOpen && (
                  <div className="document-download-menu" role="menu" aria-label="Choose download format">
                    <button type="button" role="menuitem" onClick={() => void handleDownload('pdf')} disabled={Boolean(downloadFormat)}>
                      <FileText size={16} /> Download as PDF
                    </button>
                    <button type="button" role="menuitem" onClick={() => void handleDownload('word')} disabled={Boolean(downloadFormat)}>
                      <FileText size={16} /> Download as Word (.docx)
                    </button>
                  </div>
                )}
              </div>
              {canManage && (
                <button className="icon-button delete-button" type="button" onClick={handleDelete} title="Delete document" aria-label="Delete document">
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          </div>
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          {notice && <p className="alert alert-success" role="status">{notice}</p>}
          {canManage ? (
            <form onSubmit={handleSave} className="document-editor-form">
              <label htmlFor="edit-document-title">Document title <span className="required-label">*</span></label>
              <input id="edit-document-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} required placeholder="Enter a document title" />
              <label htmlFor="edit-document-content">Content</label>
              <VoiceDictation key={documentId} defaultLanguage={defaultLanguage} transcriptionProvider={transcriptionProvider} onTranscript={handleTranscriptInsert} />
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
