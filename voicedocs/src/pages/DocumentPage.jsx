import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Clock3, Download, FileText, Save, Trash2, Sparkles, History, RotateCcw, ExternalLink, Archive, X, LoaderCircle } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import VoiceDictation from '../components/VoiceDictation'
import RichTextEditor from '../components/RichTextEditor'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import { downloadDocumentPdf, downloadBlobFile } from '../features/documents/documentExport'
import { backupDocument, createDocument, deleteDocument, fetchDocument, requestDocumentEditAccess, updateDocument, formatDocument, checkLegalDraftCompleteness, fetchDocumentVersions, fetchDocumentVersion, replaceDocumentVersion, createDocumentVersion, backupDocumentVersion, exportDocumentDocx, fetchLegalDocumentCatalog, fetchDeletedDocumentVersions, deleteDocumentVersion, restoreDocumentVersion, permanentlyDeleteDocumentVersion } from '../features/documents/documentsApi'
import { fetchUserPreferences } from '../features/current-user/preferencesApi'
import { uploadBrowserRecording } from '../features/recordings/recordingsApi'


function InlineLoading({ title, detail, progress }) {
  const hasProgress = Number.isFinite(progress)
  return (
    <div className={hasProgress ? "inline-loading-panel inline-loading-progress-panel" : "inline-loading-panel"} role="status" aria-live="polite">
      <div className="inline-loading-heading">
        <LoaderCircle className="app-loading-spinner" size={19} />
        <strong>{title}</strong>
        {hasProgress && <strong className="inline-loading-percent">{Math.round(progress)}%</strong>}
      </div>
      {detail && <p>{detail}</p>}
      {hasProgress && (
        <div className="app-loading-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}>
          <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </div>
  )
}

function formatDate(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function DocumentPage() {
  const { documentId } = useParams()
  // /documents/new is currently matched by a static route, so documentId can be undefined.
  const isNewDocument = !documentId || documentId === 'new'
  const [isDocumentTypePanelOpen, setIsDocumentTypePanelOpen] = useState(isNewDocument)
  const navigate = useNavigate()
  const { user } = useAuth()
  const [document, setDocument] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [formattedContent, setFormattedContent] = useState('')
  const [versions, setVersions] = useState([])
  const [deletedVersions, setDeletedVersions] = useState([])
  const [isVersionTrashOpen, setIsVersionTrashOpen] = useState(false)
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [activeVersionId, setActiveVersionId] = useState(null)
  const [activeTab, setActiveTab] = useState('original')
  const [isFormatting, setIsFormatting] = useState(false)
  const [draftProgress, setDraftProgress] = useState(0)
  const [draftProgressMessage, setDraftProgressMessage] = useState('Preparing your document…')
  const [isLoadingVersion, setIsLoadingVersion] = useState(false)
  const [isSavingVersion, setIsSavingVersion] = useState(false)
  const [isFormattedContentDirty, setIsFormattedContentDirty] = useState(false)
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
  const [legalCatalog, setLegalCatalog] = useState({ jurisdictions: [], categories: [] })
  const [isLegalCatalogLoading, setIsLegalCatalogLoading] = useState(true)
  const [formattingMode, setFormattingMode] = useState('general')
  const [documentMode, setDocumentMode] = useState('draft')
  const [legalPreflight, setLegalPreflight] = useState(null)
  const [legalPreflightAnswers, setLegalPreflightAnswers] = useState({})
  const [isLegalDetailsModalOpen, setIsLegalDetailsModalOpen] = useState(false)
  const [isContinuingLegalDraft, setIsContinuingLegalDraft] = useState(false)
  const [jurisdiction, setJurisdiction] = useState('IN')
  const [legalCategory, setLegalCategory] = useState('')
  const [legalDocumentType, setLegalDocumentType] = useState('')
  const contentTextareaRef = useRef(null)

  const selectedLegalCategory = legalCatalog.categories.find((item) => item.id === legalCategory)
  const legalMetadata = {
    formatting_mode: formattingMode,
    jurisdiction: formattingMode === 'legal' ? jurisdiction : null,
    legal_category: formattingMode === 'legal' ? legalCategory : null,
    document_type: formattingMode === 'legal' ? legalDocumentType : null,
  }
  const legalSelectionIsValid = formattingMode === 'general' || Boolean(jurisdiction === 'IN' && legalCategory && legalDocumentType)

  const isAccountAdmin = user?.role?.name?.trim().toLowerCase() === 'admin'
  // A newly opened draft belongs to the current user and must be editable
  // before it has a persisted owner_user_id from the API.
  const canManage = Boolean(isNewDocument || (document && (isAccountAdmin || document.owner_user_id === user?.id)))
  const canEdit = Boolean(canManage || document?.can_edit)

  const loadDocument = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      let savedPreferences = {}
      try {
        savedPreferences = await fetchUserPreferences()
        setDefaultLanguage(savedPreferences.transcription_language || 'en')
        setJurisdiction(savedPreferences.jurisdiction_country || 'IN')
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
        setDeletedVersions([])
        setSelectedVersionId(null)
        setActiveVersionId(null)
        setActiveTab('original')
        setFormattingMode('general')
        setIsDocumentTypePanelOpen(true)
        setIsFormattedContentDirty(false)
        setDocumentMode('draft')
        setJurisdiction(savedPreferences.jurisdiction_country || 'IN')
        setLegalCategory('')
        setLegalDocumentType('')
        return
      }

      const result = await fetchDocument(documentId)
      setDocument(result)
      setTitle(result.title || '')
      setContent(result.content || '')
      setFormattingMode(result.formatting_mode || 'general')
      setIsFormattedContentDirty(false)
      setDocumentMode('draft')
      setJurisdiction(result.jurisdiction || savedPreferences.jurisdiction_country || 'IN')
      setIsDocumentTypePanelOpen(false)
      setLegalCategory(result.legal_category || '')
      setLegalDocumentType(result.document_type || '')
      setActiveTab('original')
      try {
        const versionData = await fetchDocumentVersions(result.id)
        setVersions(versionData.items || [])
        setActiveVersionId(versionData.active_version_id || null)
        setSelectedVersionId(versionData.active_version_id || null)
        setActiveVersionId(versionData.active_version_id || null)
        try {
          const deletedData = await fetchDeletedDocumentVersions(result.id)
          setDeletedVersions(deletedData.items || [])
        } catch {
          setDeletedVersions([])
        }
        if (versionData.active_version_id) {
          const savedVersion = await fetchDocumentVersion(result.id, versionData.active_version_id)
          setFormattedContent(savedVersion.content_html || '')
        } else {
          setFormattedContent('')
        }
      } catch (versionError) {
        console.warn('Could not load formatted document versions.', versionError)
        setVersions([])
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
    fetchLegalDocumentCatalog()
      .then((catalog) => { if (!cancelled) setLegalCatalog(catalog) })
      .catch((catalogError) => {
        if (!cancelled) setError(catalogError.response?.data?.detail || 'Legal document options could not be loaded.')
      })
      .finally(() => { if (!cancelled) setIsLegalCatalogLoading(false) })
    return () => { cancelled = true }
  }, [])

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
    if (!legalSelectionIsValid) {
      setError('Select a legal category and document type before saving.')
      return
    }
    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      if (!isNewDocument && activeTab === 'formatted' && selectedVersionId) {
        const updatedOriginal = await updateDocument(documentId, { title: title.trim(), content, ...legalMetadata })
        setDocument(updatedOriginal)
        const audioBackupPending = await savePendingRecordings(updatedOriginal.id)
        const savedVersion = await replaceDocumentVersion(documentId, selectedVersionId, formattedContent)
        setFormattedContent(savedVersion.content_html || formattedContent)
        setIsFormattedContentDirty(false)
        setSelectedVersionId(savedVersion.id)
        const versionData = await fetchDocumentVersions(documentId)
        setVersions(versionData.items || [])
        setActiveVersionId(versionData.active_version_id || null)
        setNotice(savedVersion.backup_status === 'backed_up' && !audioBackupPending
          ? 'Formatted version saved and backed up to Google Drive.'
          : 'Formatted version saved in VoiceDocs. A Google Drive backup is pending.')
        return
      }
      const updated = isNewDocument
        ? await createDocument({ title: title.trim(), content, ...legalMetadata })
        : await updateDocument(documentId, { title: title.trim(), content, ...legalMetadata })
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
      if (isNewDocument) {
        setIsDocumentTypePanelOpen(false)
        navigate(`/documents/${updated.id}`, { replace: true })
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not save your changes.')
    } finally {
      setIsSaving(false)
    }
  }

  async function generateLegalDraft(legalDraftDetails = {}) {
    // Keep the original narration unchanged. Intake answers are sent separately.
    setDraftProgress(62); setDraftProgressMessage('Saving your original transcript…')
    const updatedOriginal = await updateDocument(document.id, { title: title.trim(), content, ...legalMetadata })
    setDocument(updatedOriginal)
    setContent(updatedOriginal.content || content)
    setDraftProgress(72); setDraftProgressMessage('AI is preparing your document…')
    try {
      const result = await formatDocument(document.id, {
        ...legalMetadata,
        drafting_mode: formattingMode === 'legal' && documentMode === 'draft',
        document_mode: documentMode,
        legal_draft_details: legalDraftDetails,
      })
      setDraftProgress(90); setDraftProgressMessage('Applying document formatting…')
      setFormattedContent(result.content_html || '')
      setIsFormattedContentDirty(false)
      setSelectedVersionId(result.id)
      setDraftProgress(90); setDraftProgressMessage('Saving the completed draft…')
      const versionData = await fetchDocumentVersions(document.id)
      setVersions(versionData.items || [])
      setActiveVersionId(versionData.active_version_id || null)
      setActiveTab('formatted')
      setIsDocumentTypePanelOpen(false)
      setDraftProgress(100); setDraftProgressMessage('Your document is ready.')
      const backupPending = result.backup_status !== 'backed_up'
      const completionMessage = backupPending
        ? 'Your legal draft is ready and saved in VoiceDocs. A Google Drive backup is pending.'
        : 'Your legal draft is ready and backed up to Google Drive.'
      setNotice(completionMessage)
      window.dispatchEvent(new CustomEvent('voicedocs:legal-draft-finished', {
        detail: { documentId: document.id, status: 'ready', backupPending },
      }))
    } catch (draftError) {
      window.dispatchEvent(new CustomEvent('voicedocs:legal-draft-finished', {
        detail: { documentId: document.id, status: 'failed' },
      }))
      throw draftError
    }
  }

  async function handleFormatDocument() {
    if (!document?.id || document.id === 'new') return
    setIsFormatting(true); setDraftProgress(8); setDraftProgressMessage('Checking document settings…'); setError(''); setNotice(''); setLegalPreflight(null)
    try {
      if (!legalSelectionIsValid) throw new Error('Select a legal category and document type before formatting.')
      setDraftProgress(18); setDraftProgressMessage('Saving your original transcript…')
      const savedOriginal = await updateDocument(document.id, { title: title.trim(), content, ...legalMetadata })
      setDocument(savedOriginal); setContent(savedOriginal.content || content)
      setDraftProgress(32); setDraftProgressMessage('Preparing attached audio…')
      await savePendingRecordings(savedOriginal.id)
      setDraftProgress(48); setDraftProgressMessage('Checking required legal information…')
      if (formattingMode === 'legal' && documentMode === 'draft') {
        const assessment = await checkLegalDraftCompleteness(document.id)
        setDraftProgress(58); setDraftProgressMessage('Completeness check finished…')
        if (assessment.status === 'needs_information') { setLegalPreflight(assessment); setLegalPreflightAnswers({}); setIsLegalDetailsModalOpen(false); setNotice(''); return }
      }
      await generateLegalDraft()
    } catch (formatError) { setError(formatError.response?.data?.detail || formatError.message || 'Could not format this document. Please try again.') }
    finally { setIsFormatting(false); setDraftProgress(0) }
  }

  async function handleContinueLegalDraft(allowPlaceholders = false) {
    if (!legalPreflight || !document?.id) return
    setIsContinuingLegalDraft(true); setDraftProgress(12); setDraftProgressMessage('Preparing the details you supplied…'); setError('')
    try {
      const placeholderValues = {
        notice_date: '[नोटीसची तारीख]',
        recipient_full_address: '[प्राप्तकर्त्याचा संपूर्ण पत्ता व पिनकोड]',
        sender_full_address: '[पाठविणाऱ्याचा संपूर्ण पत्ता]',
        dishonour_information_received_date: '[बँकेचा मेमो/अनादराची माहिती मिळाल्याची तारीख]',
        cheque_validity_confirmation: '[धनादेश वैधता कालावधीतील सादरीकरणाची पुष्टी]',
      }
      const unansweredRequired = legalPreflight.missing_information.filter((item) => item.importance.startsWith('required') && !(legalPreflightAnswers[item.field] || '').trim())
      if (unansweredRequired.length && !allowPlaceholders) {
        setError('Please fill the required details, or choose Generate Draft with Placeholders.')
        return
      }
      const legalDraftDetails = {}
      for (const item of legalPreflight.missing_information) {
        const answer = (legalPreflightAnswers[item.field] || '').trim()
        if (answer) legalDraftDetails[item.field] = answer
        else if (allowPlaceholders) legalDraftDetails[item.field] = placeholderValues[item.field] || '[माहिती उपलब्ध नाही — अंतिम वापरापूर्वी भरा]'
      }
      await generateLegalDraft(legalDraftDetails)
      setLegalPreflight(null); setLegalPreflightAnswers({}); setIsLegalDetailsModalOpen(false)
      if (allowPlaceholders && Object.values(legalDraftDetails).some((value) => value.startsWith('['))) {
        setNotice('Draft generated with clearly marked missing-information placeholders. Complete and legally review them before use.')
      }
    } catch (draftError) { setError(draftError.response?.data?.detail || draftError.message || 'Could not continue legal drafting.') }
    finally { setIsContinuingLegalDraft(false); setDraftProgress(0) }
  }

  async function handleSaveAsNewVersion() {
    if (!document?.id || document.id === 'new' || !formattedContent.trim()) return
    setIsSavingVersion(true)
    setError('')
    setNotice('')
    try {
      const updatedOriginal = await updateDocument(document.id, { title: title.trim(), content, ...legalMetadata })
      setDocument(updatedOriginal)
      const audioBackupPending = await savePendingRecordings(updatedOriginal.id)
      const result = await createDocumentVersion(document.id, formattedContent)
      setSelectedVersionId(result.id)
      setFormattedContent(result.content_html || formattedContent)
      setIsFormattedContentDirty(false)
      const versionData = await fetchDocumentVersions(document.id)
      setVersions(versionData.items || [])
      setActiveVersionId(versionData.active_version_id || null)
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
      setActiveVersionId(versionData.active_version_id || null)
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
      setIsFormattedContentDirty(false)
    } catch (loadError) {
      setError(loadError.response?.data?.detail || 'Could not load that formatted version.')
    }
  }

  async function handleSelectVersion(versionId) {
    if (!versionId || versionId === selectedVersionId) return
    setError('')
    setIsLoadingVersion(true)
    try {
      // Browsing history is local to this editor; saving a version changes the active version.
      const selected = await fetchDocumentVersion(document.id, versionId)
      setSelectedVersionId(versionId)
      setFormattedContent(selected.content_html || '')
      setIsFormattedContentDirty(false)
      setNotice(`Loaded formatted version ${selected.version_number}.`)
    } catch (loadError) {
      setError(loadError.response?.data?.detail || 'Could not load that formatted version.')
    } finally {
      setIsLoadingVersion(false)
    }
  }

  async function handleDeleteVersion() {
    if (!canManage || !selectedVersionId) return
    const selected = versions.find((item) => item.id === selectedVersionId)
    if (!selected) return
    if (!window.confirm(formattingMode === 'legal' ? 'Delete this formatted legal draft? The original transcript will remain available, and this draft can be restored from Version Trash for 30 days.' : `Move formatted version ${selected.version_number} to Version Trash?`)) return
    setIsSavingVersion(true)
    setError('')
    setNotice('')
    try {
      await deleteDocumentVersion(document.id, selectedVersionId)
      const [versionData, deletedData] = await Promise.all([
        fetchDocumentVersions(document.id),
        fetchDeletedDocumentVersions(document.id),
      ])
      setVersions(versionData.items || [])
      setActiveVersionId(versionData.active_version_id || null)
      setDeletedVersions(deletedData.items || [])
      if (versionData.active_version_id) {
        const active = await fetchDocumentVersion(document.id, versionData.active_version_id)
        setSelectedVersionId(active.id)
        setFormattedContent(active.content_html || '')
      } else {
        setSelectedVersionId(null)
        setFormattedContent('')
        setActiveTab('original')
      }
      setNotice(formattingMode === 'legal' ? 'Draft legal document moved to Version Trash. The original transcript is unchanged.' : 'Formatted version moved to Version Trash.')
    } catch (deleteError) {
      setError(deleteError.response?.data?.detail || 'Could not move this version to Trash.')
    } finally {
      setIsSavingVersion(false)
    }
  }

  async function handleRestoreVersion(versionId) {
    setIsSavingVersion(true)
    setError('')
    try {
      await restoreDocumentVersion(document.id, versionId)
      const [versionData, deletedData] = await Promise.all([
        fetchDocumentVersions(document.id),
        fetchDeletedDocumentVersions(document.id),
      ])
      setVersions(versionData.items || [])
      setActiveVersionId(versionData.active_version_id || null)
      setDeletedVersions(deletedData.items || [])
      setNotice('Formatted version restored. Back it up to Google Drive when ready.')
    } catch (restoreError) {
      setError(restoreError.response?.data?.detail || 'Could not restore this version.')
    } finally {
      setIsSavingVersion(false)
    }
  }

  async function handlePermanentlyDeleteVersion(version) {
    if (!window.confirm(`Permanently delete formatted version ${version.version_number}? This cannot be undone.`)) return
    setIsSavingVersion(true)
    setError('')
    try {
      await permanentlyDeleteDocumentVersion(document.id, version.id)
      const deletedData = await fetchDeletedDocumentVersions(document.id)
      setDeletedVersions(deletedData.items || [])
      setNotice(`Formatted version ${version.version_number} permanently deleted.`)
    } catch (deleteError) {
      setError(deleteError.response?.data?.detail || 'Could not permanently delete this version.')
    } finally {
      setIsSavingVersion(false)
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
    if (!window.confirm('Move this document to Trash? You can restore it later. Its Google Drive backups will be removed.')) return
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
        if (!document?.id || document.id === 'new') {
          throw new Error('Save the document before downloading it as Word.')
        }
        const blob = await exportDocumentDocx(document.id, exportContent)
        downloadBlobFile(blob, exportTitle)
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
                <section className="document-page-content"><div className="documents-state"><LoaderCircle className="app-loading-spinner" size={30} /><span>Opening your document…</span></div></section>
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
        {(isFormatting || isContinuingLegalDraft) && <InlineLoading title="Preparing your draft" detail={draftProgressMessage} progress={draftProgress} />}
        {!isFormatting && !isContinuingLegalDraft && (isSaving || isBackingUp || Boolean(downloadFormat) || isSavingVersion || isRequestingAccess || isLoadingVersion) && (
          <InlineLoading
            title={isSaving ? 'Saving document…' : isBackingUp ? 'Backing up to Google Drive…' : downloadFormat ? `Preparing ${downloadFormat.toUpperCase()} download…` : isSavingVersion ? 'Saving formatted version…' : isRequestingAccess ? 'Sending access request…' : 'Loading formatted version…'}
            detail="Please wait while VoiceDocs completes this action."
          />
        )}
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
            <div className="document-toolbar-actions">
              {!isNewDocument && document.drive_web_view_link && (
                <a className="icon-button" href={document.drive_web_view_link} target="_blank" rel="noreferrer" title="Open in Google Drive" aria-label="Open in Google Drive"><ExternalLink size={17} /></a>
              )}
              {!isNewDocument && canEdit && activeTab !== 'formatted' && (
                <button className="icon-button" type="button" onClick={handleFormatDocument} disabled={isFormatting || !content.trim() || !legalSelectionIsValid} title={isFormatting ? 'Preparing document…' : formattingMode === 'legal' ? 'Draft legal document' : 'Draft or format document'} aria-label={formattingMode === 'legal' ? 'Draft legal document' : 'Draft or format document'}>
                  <Sparkles size={17} />
                </button>
              )}
              {canEdit && (activeTab !== 'formatted' || isFormattedContentDirty) && (
                <button className="icon-button" type="submit" form="document-editor-form" disabled={isSaving || !title.trim() || !legalSelectionIsValid} title={isSaving ? 'Saving document…' : activeTab === 'formatted' ? 'Save formatted document' : isNewDocument ? 'Create document' : 'Save document'} aria-label={activeTab === 'formatted' ? 'Save formatted document' : isNewDocument ? 'Create document' : 'Save document'}>
                  <Save size={17} />
                </button>
              )}
              {!isNewDocument && canManage && (document.backup_status !== 'backed_up' || document.audio_backup_status === 'not_backed_up') && (
                <button className="icon-button" type="button" onClick={handleBackup} disabled={isBackingUp} title={isBackingUp ? 'Backing up to Google Drive' : 'Back up to Google Drive'} aria-label={isBackingUp ? 'Backing up to Google Drive' : 'Back up to Google Drive'}>
                  <Save size={17} />
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
                  <Download size={17} />
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
          {isVersionTrashOpen && canManage && (
            <div className="legal-details-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsVersionTrashOpen(false) }}>
              <section className="legal-details-modal version-trash-modal" role="dialog" aria-modal="true" aria-labelledby="version-trash-title">
                <div className="legal-details-modal-heading">
                  <div><h2 id="version-trash-title">Deleted drafts</h2><p>Restore a deleted formatted version or permanently delete it.</p></div>
                  <button className="legal-details-modal-close" type="button" onClick={() => setIsVersionTrashOpen(false)} aria-label="Close deleted drafts">×</button>
                </div>
                {deletedVersions.length === 0 ? <p className="version-trash-empty">No deleted drafts.</p> : deletedVersions.map((version) => (
                  <div className="version-trash-row" key={version.id}>
                    <span>Version {version.version_number} · Deleted {formatDate(version.deleted_at)}</span>
                    <div>
                      <button className="secondary-button" type="button" onClick={() => void handleRestoreVersion(version.id)} disabled={isSavingVersion}><RotateCcw size={14} /> Restore</button>
                      <button className="danger-button" type="button" onClick={() => void handlePermanentlyDeleteVersion(version)} disabled={isSavingVersion}><Trash2 size={14} /> Delete permanently</button>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          )}
          {legalPreflight && !isLegalDetailsModalOpen && (
            <div className="legal-details-modal-backdrop" role="presentation">
              <section className="legal-details-modal legal-preflight-choice-modal" role="dialog" aria-modal="true" aria-labelledby="legal-preflight-title">
                <div className="legal-details-modal-heading">
                  <h2 id="legal-preflight-title">Missing information before legal drafting</h2>
                  <button
                    type="button"
                    className="legal-details-modal-close"
                    onClick={() => { setLegalPreflight(null); setIsLegalDetailsModalOpen(false); setError('') }}
                    aria-label="Close missing information dialog"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p>VoiceDocs found details that may be needed. Add the missing details, or generate a draft with clearly marked placeholders. This check does not certify legal compliance.</p>
                <div className="document-sticky-actions">
                  <button type="button" className="primary-button" onClick={() => { setError(''); setIsLegalDetailsModalOpen(true) }} disabled={isContinuingLegalDraft}>Add Missing Details</button>
                  <button type="button" className="secondary-button" onClick={() => void handleContinueLegalDraft(true)} disabled={isContinuingLegalDraft}>{isContinuingLegalDraft ? "Preparing draft…" : "Generate Draft with Placeholders"}</button>
                  <button type="button" className="secondary-button" onClick={() => setLegalPreflight(null)} disabled={isContinuingLegalDraft}>Cancel</button>
                </div>
                <p className="legal-review-note">{legalPreflight.notice}</p>
              </section>
            </div>
          )}
          {legalPreflight && isLegalDetailsModalOpen && (
            <div className="legal-details-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isContinuingLegalDraft) setIsLegalDetailsModalOpen(false) }}>
              <section className="legal-details-modal" role="dialog" aria-modal="true" aria-labelledby="legal-details-modal-title">
                <div className="legal-details-modal-heading">
                  <div>
                    <h2 id="legal-details-modal-title">Add missing legal details</h2>
                    <p>Fill in the information you know. You can leave unknown fields blank.</p>
                  </div>
                  <button type="button" className="legal-details-modal-close" onClick={() => setIsLegalDetailsModalOpen(false)} disabled={isContinuingLegalDraft} aria-label="Close">×</button>
                </div>
                {legalPreflight.missing_information.map((item) => (
                  <div className="legal-preflight-question" key={item.field}>
                    <label htmlFor={`legal-preflight-${item.field}`}>{item.question}</label>
                    <p>{item.reason}</p>
                    <input id={`legal-preflight-${item.field}`} value={legalPreflightAnswers[item.field] || ''} onChange={(event) => setLegalPreflightAnswers((current) => ({ ...current, [item.field]: event.target.value }))} placeholder="Enter details, if available" />
                  </div>
                ))}
                {error && <p className="alert alert-error" role="alert">{error}</p>}
                <div className="document-sticky-actions">
                  <button type="button" className="primary-button" onClick={() => void handleContinueLegalDraft()} disabled={isContinuingLegalDraft}>{isContinuingLegalDraft ? "Generating draft…" : "Generate Legal Draft"}</button>
                  <button type="button" className="secondary-button" onClick={() => setIsLegalDetailsModalOpen(false)} disabled={isContinuingLegalDraft}>Back</button>
                </div>
              </section>
            </div>
          )}

          {canEdit ? (
            <form id="document-editor-form" onSubmit={handleSave} className="document-editor-form">
              {!isNewDocument && !isDocumentTypePanelOpen && (
                <div className="document-type-change-row">
                  <span>Document type and formatting preferences are hidden after creation.</span>
                  <button className="secondary-button" type="button" onClick={() => setIsDocumentTypePanelOpen(true)}>Change Document Type</button>
                </div>
              )}
              {(isNewDocument || isDocumentTypePanelOpen) && (
                <div className={isNewDocument ? 'document-type-setup-inline' : 'document-type-modal-backdrop'}>
                  <section className={isNewDocument ? 'document-format-mode-panel' : 'document-format-mode-panel document-type-modal'} role={isNewDocument ? undefined : 'dialog'} aria-modal={isNewDocument ? undefined : 'true'} aria-labelledby={isNewDocument ? undefined : 'change-document-type-title'}>
                    {!isNewDocument && (
                      <div className="document-type-modal-heading">
                        <div>
                          <span className="eyebrow">DOCUMENT SETTINGS</span>
                          <h2 id="change-document-type-title">Change document type</h2>
                          <p>Choose how VoiceDocs should prepare this document. Your original transcript will remain unchanged.</p>
                        </div>
                        <button className="legal-details-modal-close" type="button" onClick={() => setIsDocumentTypePanelOpen(false)} aria-label="Close document type settings">×</button>
                      </div>
                    )}
                <label htmlFor="document-format-mode">Formatting mode</label>
                <select
                  id="document-format-mode"
                  value={formattingMode}
                  onChange={(event) => {
                    const nextMode = event.target.value
                    setFormattingMode(nextMode)
                    if (nextMode === 'legal') setDocumentMode('draft')
                    if (nextMode === 'general') {
                      setLegalCategory('')
                      setLegalDocumentType('')
                    }
                  }}
                >
                  <option value="general">General Document</option>
                  <option value="legal">Legal Document</option>
                </select>
                {formattingMode === 'general' ? (
                  <div className="document-preparation-mode">
                    <label htmlFor="document-preparation-mode">Document preparation</label>
                    <select
                      id="document-preparation-mode"
                      value={documentMode}
                      onChange={(event) => setDocumentMode(event.target.value)}
                    >
                      <option value="draft">AI Document Drafting (recommended)</option>
                      <option value="format">Formatting Only (preserve original wording)</option>
                    </select>
                    <p className="legal-jurisdiction-note">
                      {documentMode === 'draft'
                        ? 'VoiceDocs turns rough speech or notes into a complete, professional document while preserving supplied facts.'
                        : 'VoiceDocs improves headings, paragraphs, lists and layout without rewriting your original wording.'}
                    </p>
                  </div>
                ) : (
                  <>
                  {jurisdiction !== 'IN' && <p className="settings-warning">Legal drafting templates are currently available for India only. Change your default country in Profile &amp; Settings under Settings to India to use legal drafting.</p>}
                  <p className="legal-jurisdiction-note">When enabled, VoiceDocs transforms narration into a formal legal draft while preserving supplied facts. Review the draft with a qualified legal professional.</p>
                  <div className="legal-document-selectors">
                    <div>
                      <label htmlFor="legal-category">Legal Category</label>
                      <select id="legal-category" value={legalCategory} disabled={isLegalCatalogLoading} onChange={(event) => { setLegalCategory(event.target.value); setLegalDocumentType('') }}>
                        <option value="">Select legal category</option>
                        {legalCatalog.categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="legal-document-type">Document Type</label>
                      <select id="legal-document-type" value={legalDocumentType} disabled={!selectedLegalCategory} onChange={(event) => setLegalDocumentType(event.target.value)}>
                        <option value="">Select document type</option>
                        {(selectedLegalCategory?.document_types || []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    </div>
                  </div>
                  </>
                )}
                    {isDocumentTypePanelOpen && !isNewDocument && (
                      <div className="document-type-change-actions">
                        <button className="primary-button" type="button" onClick={async () => { try { const updated = await updateDocument(document.id, { title: title.trim(), content, ...legalMetadata }); setDocument(updated); setIsDocumentTypePanelOpen(false); setNotice('Document type and formatting settings updated.') } catch (saveError) { setError(saveError.response?.data?.detail || 'Could not update document type.') } }}>Save Document Type</button>
                        <button className="secondary-button" type="button" onClick={() => { setFormattingMode(document.formatting_mode || 'general'); setJurisdiction(document.jurisdiction || jurisdiction); setLegalCategory(document.legal_category || ''); setLegalDocumentType(document.document_type || ''); setIsDocumentTypePanelOpen(false) }}>Cancel</button>
                      </div>
                    )}
                  </section>
                </div>
              )}
              {formattingMode === 'legal' && isNewDocument && <p className="legal-review-note">Review the formatted document with a qualified legal professional before use.</p>}
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
                  <RichTextEditor editorRef={contentTextareaRef} value={content} onChange={setContent} documentMode={formattingMode} />
                  <div className="editor-actions">
                    <span className="editor-hint">{isNewDocument ? 'A title is required to create this document.' : 'The original transcript is kept separately from formatted versions.'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="formatted-version-toolbar">
                    <label htmlFor="formatted-version-select"><History size={15} /> Saved versions</label>
                    <select id="formatted-version-select" value={selectedVersionId || ''} onChange={(event) => void handleSelectVersion(event.target.value)}>
                      {versions.map((version) => <option key={version.id} value={version.id}>Version {version.version_number} · {formatDate(version.created_at)}</option>)}
                    </select>
                    <div className="formatted-version-actions">
                      <button className="icon-button" type="button" onClick={handleFormatDocument} disabled={isFormatting || !content.trim()} title={isFormatting ? 'Preparing document…' : 'Format again'} aria-label="Format again"><Sparkles size={17} /></button>
                      {canManage && versions.find((version) => version.id === selectedVersionId)?.backup_status !== 'backed_up' && (
                        <button className="icon-button" type="button" onClick={handleBackupFormattedVersion} disabled={isSavingVersion} title={isSavingVersion ? 'Backing up formatted version' : 'Back up formatted version'} aria-label="Back up formatted version"><Save size={17} /></button>
                      )}
                      {canManage && selectedVersionId && (
                        <button className="icon-button delete-button" type="button" onClick={handleDeleteVersion} disabled={isSavingVersion} title="Delete draft legal document" aria-label="Delete draft legal document">
                          <Trash2 size={17} />
                        </button>
                      )}
                      {canManage && (
                        <button className="icon-button" type="button" onClick={() => setIsVersionTrashOpen(true)} title="View deleted drafts" aria-label="View deleted drafts">
                          <Archive size={17} />
                          {deletedVersions.length > 0 && <span className="icon-count">{deletedVersions.length}</span>}
                        </button>
                      )}
                    </div>
                  </div>
                  <RichTextEditor value={formattedContent} onChange={(value) => { setFormattedContent(value); setIsFormattedContentDirty(true) }} documentMode={formattingMode} />
                  <div className="editor-actions">
                    <span className="editor-hint">The original transcript remains unchanged.</span>
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
                <RichTextEditor value={document.content || ''} editable={false} documentMode={document.formatting_mode || 'general'} />
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
                  {formattedContent ? <RichTextEditor value={formattedContent} editable={false} documentMode={document.formatting_mode || 'general'} /> : <p>No formatted version has been saved yet.</p>}
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
