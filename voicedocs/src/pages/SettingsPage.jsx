import { useEffect, useState } from 'react'
import { ArrowLeft, Save, Settings as SettingsIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchUserPreferences, updateUserPreferences } from '../features/current-user/preferencesApi'
import { SUPPORTED_LANGUAGES } from '../features/current-user/languages'

export default function SettingsPage() {
  const [language, setLanguage] = useState('en')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    fetchUserPreferences()
      .then((preferences) => {
        if (!active) return
        setLanguage(preferences.transcription_language || 'en')
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || 'Could not load your settings.')
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [])

  async function handleSave(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      const updated = await updateUserPreferences({ transcription_language: language })
      setLanguage(updated.transcription_language)
      setNotice('Your default language has been saved.')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not save your settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="settings-page-shell">
      <header className="document-page-header">
        <Link className="dashboard-brand" to="/"><span className="brand-mark brand-mark-small">V</span><span>VoiceDocs</span></Link>
        <Link className="back-link" to="/"><ArrowLeft size={16} /> Workspace</Link>
      </header>
      <section className="settings-content">
        <div className="settings-heading"><span className="settings-icon"><SettingsIcon size={22} /></span><div><p className="eyebrow">ACCOUNT PREFERENCES</p><h1>User settings</h1><p>Choose the default language used when you open a document.</p></div></div>
        <form className="settings-card" onSubmit={handleSave}>
          <h2>Speech and dictation</h2>
          <label htmlFor="default-transcription-language">Default language</label>
          <select id="default-transcription-language" value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isLoading || isSaving}>
            {SUPPORTED_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <p className="settings-help">This preference is applied whenever you open any document. Changing the language inside a document affects that document session only and will not change this setting.</p>
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          {notice && <p className="alert alert-success" role="status">{notice}</p>}
          <div className="settings-actions"><button className="primary-button save-button" type="submit" disabled={isLoading || isSaving}><Save size={16} /> {isSaving ? 'Saving…' : 'Save settings'}</button></div>
        </form>
      </section>
    </main>
  )
}
