import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function BackgroundDraftNotification() {
  const [notification, setNotification] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    function handleDraftFinished(event) {
      const detail = event.detail || {}
      const documentPath = detail.documentId ? `/documents/${detail.documentId}` : ''
      if (documentPath && location.pathname === documentPath) return
      setNotification(detail)
    }

    window.addEventListener('voicedocs:legal-draft-finished', handleDraftFinished)
    return () => window.removeEventListener('voicedocs:legal-draft-finished', handleDraftFinished)
  }, [location.pathname])

  if (!notification) return null

  const failed = notification.status === 'failed'
  return (
    <aside
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', right: '24px', bottom: '24px', zIndex: 1200,
        width: 'min(380px, calc(100vw - 32px))', padding: '16px',
        borderRadius: '12px', background: 'var(--surface, #fff)',
        color: 'var(--text-primary, #172033)', border: '1px solid var(--border, #d8dee9)',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.16)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <strong>{failed ? 'Draft preparation failed' : 'Legal draft is ready'}</strong>
        <button type="button" aria-label="Dismiss notification" onClick={() => setNotification(null)}>×</button>
      </div>
      <p style={{ margin: '8px 0 12px' }}>
        {failed
          ? 'VoiceDocs could not complete the legal draft. Open the document to review the error and try again.'
          : 'Your legal document has been prepared and saved.'}
      </p>
      <button
        type="button"
        onClick={() => {
          if (notification.documentId) navigate(`/documents/${notification.documentId}`)
          setNotification(null)
        }}
      >
        Open document
      </button>
    </aside>
  )
}
