import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './BackgroundDraftNotification.css'
import { AlertCircle, Bell, CheckCircle2, FileText, Info, LoaderCircle, X } from 'lucide-react'

const DISMISS_AFTER_MS = 5000

export default function BackgroundDraftNotification() {
  const [draft, setDraft] = useState(null)
  const [activities, setActivities] = useState([])
  const [history, setHistory] = useState([])
  const [visibleIds, setVisibleIds] = useState([])
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const navigate = useNavigate()

  const visibleNotifications = useMemo(
    () => visibleIds.map((id) => history.find((item) => item.id === id)).filter(Boolean),
    [history, visibleIds],
  )

  function addNotification(detail = {}) {
    const id = `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const item = {
      id,
      type: detail.type || 'info',
      title: detail.title || 'VoiceDocs notification',
      message: detail.message || '',
      documentId: detail.documentId || null,
      documentTitle: detail.documentTitle || '',
      createdAt: new Date(),
    }
    setHistory((current) => [item, ...current])
    setVisibleIds((current) => [...current, id])
  }

  useEffect(() => {
    if (!visibleIds.length) return undefined
    const timers = visibleIds.map((id) => {
      const item = history.find((entry) => entry.id === id)
      if (!item) return null
      const elapsed = Date.now() - item.createdAt.getTime()
      const remaining = Math.max(0, DISMISS_AFTER_MS - elapsed)
      return window.setTimeout(() => {
        setVisibleIds((current) => current.filter((itemId) => itemId !== id))
      }, remaining)
    }).filter(Boolean)
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [visibleIds, history])

  useEffect(() => {
    function handleDraftStarted(event) {
      const detail = event.detail || {}
      setDraft({
        documentId: detail.documentId || null,
        title: detail.title || 'Preparing document',
        progress: Number.isFinite(detail.progress) ? detail.progress : 0,
        message: detail.message || 'Preparing your document…',
      })
    }

    function handleDraftProgress(event) {
      const detail = event.detail || {}
      setDraft((current) => current ? {
        ...current,
        ...detail,
        progress: Number.isFinite(detail.progress) ? detail.progress : current.progress,
      } : current)
    }

    function handleDraftFinished(event) {
      const detail = event.detail || {}
      setDraft((current) => current?.documentId && detail.documentId && current.documentId !== detail.documentId ? current : null)
      const failed = detail.status === 'failed'
      addNotification({
        type: failed ? 'error' : 'success',
        title: failed ? 'Legal draft preparation failed' : 'Legal draft is ready',
        message: failed
          ? 'Open the document to review the error and try again.'
          : detail.backupPending
            ? 'Saved in VoiceDocs. Google Drive backup is pending.'
            : 'Your document has been prepared successfully.',
        documentId: detail.documentId,
        documentTitle: detail.title || '',
      })
    }

    function handleDraftDismissed(event) {
      const detail = event.detail || {}
      setDraft((current) => current?.documentId === detail.documentId ? null : current)
    }

    function handleNotification(event) {
      addNotification(event.detail || {})
    }

    function handleActivityUpdated(event) {
      const detail = event.detail || {}
      if (!detail.id) return
      setActivities((current) => current.some((item) => item.id === detail.id)
        ? current.map((item) => item.id === detail.id ? { ...item, ...detail } : item)
        : [...current, detail])
    }

    function handleActivityFinished(event) {
      const id = event.detail?.id
      if (id) setActivities((current) => current.filter((item) => item.id !== id))
    }

    window.addEventListener('voicedocs:legal-draft-started', handleDraftStarted)
    window.addEventListener('voicedocs:legal-draft-progress', handleDraftProgress)
    window.addEventListener('voicedocs:legal-draft-finished', handleDraftFinished)
    window.addEventListener('voicedocs:legal-draft-dismissed', handleDraftDismissed)
    window.addEventListener('voicedocs:notification', handleNotification)
    window.addEventListener('voicedocs:activity-updated', handleActivityUpdated)
    window.addEventListener('voicedocs:activity-finished', handleActivityFinished)
    return () => {
      window.removeEventListener('voicedocs:legal-draft-started', handleDraftStarted)
      window.removeEventListener('voicedocs:legal-draft-progress', handleDraftProgress)
      window.removeEventListener('voicedocs:legal-draft-finished', handleDraftFinished)
      window.removeEventListener('voicedocs:legal-draft-dismissed', handleDraftDismissed)
      window.removeEventListener('voicedocs:notification', handleNotification)
      window.removeEventListener('voicedocs:activity-updated', handleActivityUpdated)
      window.removeEventListener('voicedocs:activity-finished', handleActivityFinished)
    }
  }, [])

  function clearAllNotifications() {
    setHistory([])
    setVisibleIds([])
  }

  function openDocument(documentId) {
    if (documentId) navigate(`/documents/${documentId}`)
    setIsHistoryOpen(false)
  }

  const notificationIcon = (type) => {
    if (type === 'success') return <CheckCircle2 size={17} />
    if (type === 'error') return <AlertCircle size={17} />
    return <Info size={17} />
  }

  return (
    <div className="voicedocs-notification-dock" aria-live="polite">
      {draft && (
        <section className="voicedocs-draft-wrap">
          <div className="voicedocs-draft-hover-details" role="tooltip">
            <div className="voicedocs-draft-details-heading">
              <FileText size={18} />
              <div>
                <strong>{draft.title}</strong>
                <span>Legal document preparation</span>
              </div>
            </div>
            <div className="voicedocs-draft-details-progress">
              <strong>{Math.round(draft.progress)}%</strong>
              <span>{draft.message}</span>
            </div>
            <div className="voicedocs-draft-progress-track">
              <span style={{ width: `${Math.min(100, Math.max(0, draft.progress))}%` }} />
            </div>
            <p className="voicedocs-draft-details-hint">Preparation continues while you navigate to other pages.</p>
          </div>
          <button
            type="button"
            className="voicedocs-draft-card"
            onClick={() => openDocument(draft.documentId)}
            title="Open the document being prepared"
          >
            <span className="voicedocs-draft-card-icon"><FileText size={17} /></span>
            <span className="voicedocs-draft-card-copy">
              <strong>{draft.title}</strong>
              <span>{draft.message}</span>
              <span className="voicedocs-draft-card-track">
                <span style={{ width: `${Math.min(100, Math.max(0, draft.progress))}%` }} />
              </span>
            </span>
            <strong className="voicedocs-draft-percent">{Math.round(draft.progress)}%</strong>
          </button>
        </section>
      )}

      {activities.map((activity) => (
        <article className="voicedocs-toast voicedocs-toast-activity" key={activity.id} role="status">
          <span className="voicedocs-toast-icon"><LoaderCircle size={17} className="app-loading-spinner" /></span>
          <div className="voicedocs-toast-content voicedocs-activity-content">
            <strong>{activity.title}</strong>
            {activity.message && <span>{activity.message}</span>}
            {Number.isFinite(activity.progress) && (
              <span className="voicedocs-toast-progress">
                <span style={{ width: `${Math.min(100, Math.max(0, activity.progress))}%` }} />
              </span>
            )}
          </div>
        </article>
      ))}

      {visibleNotifications.map((item) => (
        <article className={`voicedocs-toast voicedocs-toast-${item.type}`} key={item.id}>
          <span className="voicedocs-toast-icon">{notificationIcon(item.type)}</span>
          <button
            type="button"
            className="voicedocs-toast-content"
            onClick={() => item.documentId && openDocument(item.documentId)}
            disabled={!item.documentId}
          >
            <strong>{item.title}</strong>
            {item.message && <span>{item.message}</span>}
            {item.documentTitle && <small>{item.documentTitle}</small>}
          </button>
          <button
            type="button"
            className="voicedocs-toast-close"
            aria-label="Dismiss notification"
            onClick={() => setVisibleIds((current) => current.filter((id) => id !== item.id))}
          >
            <X size={15} />
          </button>
        </article>
      ))}

      {isHistoryOpen && (
        <section className="voicedocs-notification-history" aria-label="Notification history">
          <header>
            <div>
              <strong>Notifications</strong>
              <span>{history.length} saved</span>
            </div>
            <button type="button" onClick={clearAllNotifications} aria-label="Clear all notifications" title="Clear all">
              <X size={17} />
            </button>
          </header>
          <div className="voicedocs-notification-history-list">
            {history.length === 0 ? (
              <p className="voicedocs-notification-empty">No notifications yet.</p>
            ) : [...history].reverse().map((item) => (
              <div className="voicedocs-history-item" key={item.id}>
                <span className={`voicedocs-history-icon voicedocs-history-icon-${item.type}`}>{notificationIcon(item.type)}</span>
                <div>
                  <strong>{item.title}</strong>
                  {item.message && <p>{item.message}</p>}
                  {item.documentTitle && <small>{item.documentTitle}</small>}
                  <time>{item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
                <button
                  type="button"
                  aria-label="Remove notification"
                  onClick={() => {
                    setHistory((current) => current.filter((entry) => entry.id !== item.id))
                    setVisibleIds((current) => current.filter((id) => id !== item.id))
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        className={`voicedocs-notification-bell${isHistoryOpen ? ' is-open' : ''}`}
        onClick={() => setIsHistoryOpen((current) => !current)}
        aria-label={isHistoryOpen ? 'Close notifications' : 'Open notifications'}
        aria-expanded={isHistoryOpen}
      >
        <Bell size={20} />
        {history.length > 0 && <span>{history.length > 99 ? '99+' : history.length}</span>}
      </button>
    </div>
  )
}
