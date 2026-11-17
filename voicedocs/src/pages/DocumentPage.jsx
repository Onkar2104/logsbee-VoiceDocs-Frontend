import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Clock3, Download, FileText, Save, Trash2, Sparkles, History } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import VoiceDictation from '../components/VoiceDictation'
import RichTextEditor from '../components/RichTextEditor'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { downloadDocumentPdf, downloadDocumentWord } from '../features/documents/documentExport'
import { backupDocument, createDocument, deleteDocument, fetchDocument, requestDocumentEditAccess, updateDocument, formatDocument, fetchDocumentVersions, fetchDocumentVersion, replaceDocumentVersion, createDocumentVersion, backupDocumentVersion } from '../features/documents/documentsApi'
import { fetchUserPreferences } from '../features/current-user/preferencesApi'
import { uploadBrowserRecording } from '../features/recordings/recordingsApi'

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
  const [formattedContent, setFormattedContent] = useState('')
  const [versions, setVersions] = useState([])
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [activeTab, setActiveTab] = useState('original')
  const [isFormatting, setIsFormatting] = useState(false)
  const [isSavingVersion, setIsSavingVersion] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [defaultLanguage, setDefaultLanguage] = useState('en')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isRequestingAccess, setIsRequestingAccess] = useState(false)
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false)
  const [downloadFormat, setDownloadFormat] = useState('')
  const [pendingRecordings, setPendingRecordings] = useState([])
  const [isBackingUp, setIsBackingUp] = useState(false)
  const contentTextareaRef = useRef(null)

  const isAccountAdmin = user?.role?.name?.trim().toLowerCase() === 'admin'
  // A newly opened draft belongs to the current user and must be editable
  // before it has a persisted owner_user_id from the API.
  const canManage = Boolean(isNewDocument || (document && (isAccountAdmin || document.owner_user_id === user?.id)))
  const canEdit = Boolean(canManage || document?.can_edit)

  const loadDocument = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      try {
        const preferences = await fetchUserPreferences()
        setDefaultLanguage(preferences.transcription_language || 'en')
      } catch (preferencesError) {
        // A preferences endpoint/migration issue must not prevent document access.
        console.warn('Could not load speech preferences; using defaults.', preferencesError)
        setDefaultLanguage('en')
      }

      if (isNewDocument) {
        setDocument({ id: 'new', title: '', content: '', updated_at: null, owner_user_id: user?.id })
        setTitle('')
        setContent('')
        setFormattedContent('')
        setVersions([])
        setSelectedVersionId(null)
        setActiveTab('original')
        return
      }

      const result = await fetchDocument(documentId)
      setDocument(result)
      setTitle(result.title || '')
      setContent(result.content || '')
      setActiveTab('original')
      try {
        const versionData = await fetchDocumentVersions(result.id)
        setVersions(versionData.items || [])
        setSelectedVersionId(versionData.active_version_id || null)
        if (versionData.active_version_id) {
          const savedVersion = await fetchDocumentVersion(result.id, versionData.active_version_id)
          setFormattedContent(savedVersion.content_html || '')
        } else {
          setFormattedContent('')
        }
      } catch (versionError) {
        console.warn('Could not load formatted document versions.', versionError)
        setVersions([])
        setActiveVersionId(null)
        setSelectedVersionId(null)
        setFormattedContent('')
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not load this document.')
    } finally {
      setIsLoading(false)
    }
  }, [documentId, isNewDocument, user])

  useEffect(() => {
    let cancelled = false
    const startLoading = async () => {
      await Promise.resolve()
      if (!cancelled) await loadDocument()
    }
    void startLoading()
    return () => { cancelled = true }
  }, [loadDocument])

  function handleTranscriptInsert(transcript, recording = null, options = {}) {
    const editor = contentTextareaRef.current
    if (!editor) return
    if (!options.alreadyInserted && transcript?.trim()) editor.chain().focus().insertContent(transcript.trim()).run()
    if (recording?.blob?.size) {
      setPendingRecordings((current) => [...current, recording])
      setNotice('Transcription inserted. Audio will be saved to Google Drive when you create or save this document.')
    } else {
      setNotice('Transcription inserted. Save your document to keep the changes.')
    }
  }

  function handleLiveTranscriptInsert(phrase) {
    const editor = contentTextareaRef.current
    if (!editor || !phrase?.trim()) return
    editor.chain().focus().insertContent(`${phrase.trim()} `).run()
  }

  async function savePendingRecordings(savedDocumentId) {
    if (!pendingRecordings.length) return false
    let backupPending = false
    for (const recording of pendingRecordings) {
      const formData = new FormData()
      formData.append('file', recording.blob, recording.filename)
      formData.append('transcript', recording.transcript || '')
      const uploadResult = await uploadBrowserRecording(formData, {
        duration: recording.duration,
        language: recording.language,
        documentId: savedDocumentId,
      })
      if (uploadResult.backup_status !== 'backed_up') backupPending = true
      // Remove each successful upload immediately so retrying after a later
      // failure does not create duplicate Drive recordings.
      setPendingRecordings((current) => current.filter((item) => item !== recording))
    }
    return backupPending
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
      if (!isNewDocument && activeTab === 'formatted' && selectedVersionId) {
        const updatedOriginal = await updateDocument(documentId, { title: title.trim(), content })
        setDocument(updatedOriginal)
        const audioBackupPending = await savePendingRecordings(updatedOriginal.id)
        const savedVersion = await replaceDocumentVersion(documentId, selectedVersionId, formattedContent)
        setFormattedContent(savedVersion.content_html || formattedContent)
        setSelectedVersionId(savedVersion.id)
        const versionData = await fetchDocumentVersions(documentId)
        setVersions(versionData.items || [])
        setNotice(savedVersion.backup_status === 'backed_up' && !audioBackupPending
          ? 'Formatted version saved and backed up to Google Drive.'
          : 'Formatted version saved in VoiceDocs. A Google Drive backup is pending.')
        return
      }
      const updated = isNewDocument
        ? await createDocument({ title: title.trim(), content })
        : await updateDocument(documentId, { title: title.trim(), content })
      setDocument(updated)
      setTitle(updated.title)
      setContent(updated.content)
      try {
        const audioPending = await savePendingRecordings(updated.id)
        const refreshed = await fetchDocument(updated.id)
        setDocument(refreshed)
        setContent(refreshed.content || content)
        setNotice(refreshed.backup_status === 'backed_up' && refreshed.audio_backup_status !== 'not_backed_up' && !audioPending
          ? (isNewDocument ? 'Document and audio saved to Google Drive.' : 'Changes saved to Google Drive.')
          : 'Saved in VoiceDocs database. Google Drive backup is pending; use Back up to Google Drive when available.')
      } catch (audioError) {
        setError(audioError.response?.data?.detail || audioError.message || 'The document was saved, but audio upload failed. Your pending audio can be backed up later.')
      }
      if (isNewDocument) navigate(`/documents/${updated.id}`, { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not save your changes.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleFormatDocument() {
    if (!document?.id || document.id === 'new') return
    setIsFormatting(true)
    setError('')
    setNotice('')
    try {
      const savedOriginal = await updateDocument(document.id, { title: title.trim(), content })
      setDocument(savedOriginal)
      setContent(savedOriginal.content || content)
      const audioBackupPending = await savePendingRecordings(savedOriginal.id)
      const result = await formatDocument(document.id)
      setFormattedContent(result.content_html || '')
      setSelectedVersionId(result.id)
      const versionData = await fetchDocumentVersions(document.id)
      setVersions(versionData.items || [])
      setActiveTab('formatted')
      setNotice(result.backup_status === 'backed_up' && !audioBackupPending
        ? 'Your formatted document is ready and backed up to Google Drive.'
        : 'Your formatted document is ready and saved in VoiceDocs. A Google Drive backup is pending.')
    } catch (formatError) {
      setError(formatError.response?.data?.detail || 'Could not format this document. Please try again.')
    } finally {
      setIsFormatting(false)
    }
  }

  async function handleSaveAsNewVersion() {
    if (!document?.id || document.id === 'new' || !formattedContent.trim()) return
    setIsSavingVersion(true)
    setError('')
    setNotice('')
    try {
      const updatedOriginal = await updateDocument(document.id, { title: title.trim(), content })
      setDocument(updatedOriginal)
      const audioBackupPending = await savePendingRecordings(updatedOriginal.id)
      const result = await createDocumentVersion(document.id, formattedContent)
      setActiveVersionId(result.id)
      setSelectedVersionId(result.id)
      setFormattedContent(result.content_html || formattedContent)
      const versionData = await fetchDocumentVersions(document.id)
      setVersions(versionData.items || [])
      setNotice(result.backup_status === 'backed_up' && !audioBackupPending
        ? 'A new formatted version was saved and backed up to Google Drive.'
        : 'A new formatted version was saved in VoiceDocs. A Google Drive backup is pending.')
    } catch (saveError) {
      setError(saveError.response?.data?.detail || 'Could not save a new formatted version.')
    } finally {
      setIsSavingVersion(false)
    }
  }

  async function handleBackupFormattedVersion() {
    if (!document?.id || !selectedVersionId) return
    setIsSavingVersion(true)
    setError('')
    setNotice('')
    try {
      await backupDocumentVersion(document.id, selectedVersionId)
      const versionData = await fetchDocumentVersions(document.id)
      setVersions(versionData.items || [])
      setNotice('Formatted version backed up to Google Drive. VoiceDocs database copy is retained.')
    } catch (backupError) {
      setError(backupError.response?.data?.detail || 'Formatted version backup failed. It remains saved in VoiceDocs.')
    } finally {
      setIsSavingVersion(false)
    }
  }

  async function handleViewVersion(versionId) {
    if (!versionId || versionId === selectedVersionId) return
    setError('')
    try {
      const selected = await fetchDocumentVersion(document.id, versionId)
      setSelectedVersionId(versionId)
      setFormattedContent(selected.content_html || '')
    } catch (loadError) {
      setError(loadError.response?.data?.detail || 'Could not load that formatted version.')
    }
  }

  async function handleSelectVersion(versionId) {
    if (!versionId || versionId === selectedVersionId) return
    setError('')
    try {
      // Browsing history is local to this editor; saving a version changes the active version.
      const selected = await fetchDocumentVersion(document.id, versionId)
      setActiveVersionId(versionId)
      setFormattedContent(selected.content_html || '')
      setNotice(`Loaded formatted version ${selected.version_number}.`)
    } catch (loadError) {
      setError(loadError.response?.data?.detail || 'Could not load that formatted version.')
    }
  }

  async function handleBackup() {
    if (!document?.id || document.id === 'new') return
    setIsBackingUp(true)
    setError('')
    setNotice('')
    try {
      const result = await backupDocument(document.id)
      const refreshed = await fetchDocument(document.id)
      setDocument({ ...refreshed, audio_backup_status: result.audio_backup_status })
      setContent(refreshed.content || '')
      setNotice(result.audio_pending
        ? `Document backed up. ${result.audio_pending} audio file(s) still need backup; you can retry.`
        : 'Document and associated audio are backed up to Google Drive. VoiceDocs database copies are retained.')
    } catch (backupError) {
      setError(backupError.response?.data?.detail || 'Backup failed. Your document and audio remain stored in VoiceDocs.')
    } finally {
      setIsBackingUp(false)
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
      const exportContent = activeTab === 'formatted' ? formattedContent : (canManage ? content : document.content)
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
            {!isNewDocument && (
              <span className={`backup-status ${document.backup_status === 'backed_up' && document.audio_backup_status !== 'not_backed_up' ? 'backup-status-done' : 'backup-status-pending'}`}>
                {document.backup_status === 'backed_up' && document.audio_backup_status !== 'not_backed_up' ? 'Backed up to Drive' : 'Backup pending'}
              </span>
            )}
            {!isNewDocument && document.drive_web_view_link && (
              <a className="secondary-button" href={document.drive_web_view_link} target="_blank" rel="noreferrer">Open in Google Drive</a>
            )}
            <div className="document-toolbar-actions">
              {!isNewDocument && canManage && (document.backup_status !== 'backed_up' || document.audio_backup_status === 'not_backed_up') && (
                <button className="secondary-button" type="button" onClick={handleBackup} disabled={isBackingUp}>
                  {isBackingUp ? 'Backing up…' : 'Back up to Google Drive'}
                </button>
              )}
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
          {canEdit ? (
            <form onSubmit={handleSave} className="document-editor-form">
              <label htmlFor="edit-document-title">Document title <span className="required-label">*</span></label>
              <input id="edit-document-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} required placeholder="Enter a document title" />
              <label htmlFor="edit-document-content">Content</label>
              {!isNewDocument && (
                <div className="document-content-tabs" role="tablist" aria-label="Document content">
                  <button type="button" role="tab" aria-selected={activeTab === 'original'} className={activeTab === 'original' ? 'active' : ''} onClick={() => setActiveTab('original')}>Original Transcript</button>
                  <button type="button" role="tab" aria-selected={activeTab === 'formatted'} className={activeTab === 'formatted' ? 'active' : ''} onClick={() => setActiveTab('formatted')}>Formatted Document</button>
                </div>
              )}
              {activeTab === 'original' || isNewDocument ? (
                <>
                  <VoiceDictation key={documentId} defaultLanguage={defaultLanguage} onTranscript={handleTranscriptInsert} onLiveTranscript={handleLiveTranscriptInsert} />
                  <RichTextEditor editorRef={contentTextareaRef} value={content} onChange={setContent} />
                  <div className="editor-actions">
                    <span className="editor-hint">{isNewDocument ? 'A title is required to create this document.' : 'The original transcript is kept separately from formatted versions.'}</span>
                    <div className="document-version-actions">
                      {!isNewDocument && <button className="secondary-button" type="button" onClick={handleFormatDocument} disabled={isFormatting || !content.trim()}><Sparkles size={16} /> {isFormatting ? 'AI is formatting your document…' : 'Format Document'}</button>}
                      <button className="primary-button save-button" type="submit" disabled={isSaving || !title.trim()}><Save size={16} /> {isSaving ? 'Saving…' : isNewDocument ? 'Create document' : 'Save original'}</button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="formatted-version-toolbar">
                    <label htmlFor="formatted-version-select"><History size={15} /> Saved versions</label>
                    <select id="formatted-version-select" value={selectedVersionId || ''} onChange={(event) => void handleSelectVersion(event.target.value)}>
                      {versions.map((version) => <option key={version.id} value={version.id}>Version {version.version_number} · {formatDate(version.created_at)}</option>)}
                    </select>
                    <button className="secondary-button" type="button" onClick={handleFormatDocument} disabled={isFormatting || !content.trim()}><Sparkles size={15} /> {isFormatting ? 'AI is formatting your document…' : 'Format again'}</button>
                    {canManage && versions.find((version) => version.id === selectedVersionId)?.backup_status !== 'backed_up' && (
                      <button className="secondary-button" type="button" onClick={handleBackupFormattedVersion} disabled={isSavingVersion}>
                        {isSavingVersion ? 'Backing up…' : 'Back up formatted version'}
                      </button>
                    )}
                  </div>
                  <RichTextEditor value={formattedContent} onChange={setFormattedContent} />
                  <div className="editor-actions">
                    <span className="editor-hint">The original transcript remains unchanged.</span>
                    <div className="document-version-actions">
                      <button className="secondary-button" type="button" onClick={handleSaveAsNewVersion} disabled={isSavingVersion || !formattedContent.trim()}>{isSavingVersion ? 'Saving…' : 'Save as new version'}</button>
                      <button className="primary-button save-button" type="submit" disabled={isSaving || !title.trim() || !selectedVersionId}><Save size={16} /> {isSaving ? 'Saving…' : 'Replace current version'}</button>
                    </div>
                  </div>
                </>
              )}
            </form>
          ) : (
            <div className="document-readonly">
              <div className="readonly-notice">You have view access to this document. Request edit access from its owner if you need to make changes.</div>
              <div className="readonly-actions"><button className="primary-button save-button" type="button" onClick={handleRequestEditAccess} disabled={isRequestingAccess}>{isRequestingAccess ? 'Sending request…' : 'Request edit access'}</button></div>
              <h2>{document.title}</h2>
              <div className="document-content-tabs" role="tablist" aria-label="Document content">
                <button type="button" role="tab" aria-selected={activeTab === 'original'} className={activeTab === 'original' ? 'active' : ''} onClick={() => setActiveTab('original')}>Original Transcript</button>
                <button type="button" role="tab" aria-selected={activeTab === 'formatted'} className={activeTab === 'formatted' ? 'active' : ''} onClick={() => setActiveTab('formatted')}>Formatted Document</button>
              </div>
              {activeTab === 'original' ? (
                <RichTextEditor value={document.content || ''} editable={false} />
              ) : (
                <>
                  {versions.length > 0 && (
                    <div className="formatted-version-toolbar">
                      <label htmlFor="readonly-version-select"><History size={15} /> Saved versions</label>
                      <select id="readonly-version-select" value={selectedVersionId || ''} onChange={(event) => void handleViewVersion(event.target.value)}>
                        {versions.map((version) => <option key={version.id} value={version.id}>Version {version.version_number} · {formatDate(version.created_at)}</option>)}
                      </select>
                    </div>
                  )}
                  {formattedContent ? <RichTextEditor value={formattedContent} editable={false} /> : <p>No formatted version has been saved yet.</p>}
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
