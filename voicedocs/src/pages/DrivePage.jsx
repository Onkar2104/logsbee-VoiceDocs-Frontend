import { AudioLines, FileText, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import GoogleDrivePanel from '../components/GoogleDrivePanel'
import WorkspaceSidebar from '../components/WorkspaceSidebar'

export default function DrivePage() {
  return (
    <main className="workspace-with-sidebar">
      <WorkspaceSidebar />
      <section className="workspace-page">
        <header className="workspace-page-heading"><h1>Google Drive</h1><p>Manage your Drive connection and browse the files VoiceDocs stores there.</p></header>

        <div className="drive-library-grid drive-library-grid-top">
          <article className="drive-library-card">
            <span><AudioLines size={20} /></span>
            <h2>Audio files</h2>
            <p>Browse, play, download and remove audio recordings saved to your connected Google Drive.</p>
            <Link to="/audio">Open audio library</Link>
          </article>
          <article className="drive-library-card">
            <span><FileText size={20} /></span>
            <h2>Documents</h2>
            <p>Open and manage your VoiceDocs documents. Documents are stored as Word files in Google Drive when automatic backup is enabled.</p>
            <Link to="/documents">Open documents</Link>
            <span className="drive-coming-soon"><ShieldCheck size={14}/> DOCX backup supported</span>
          </article>
        </div>

        <GoogleDrivePanel />
      </section>
    </main>
  )
}
