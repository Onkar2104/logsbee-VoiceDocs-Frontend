import { HardDrive, FileText, AudioLines, ShieldCheck } from 'lucide-react'
import GoogleDrivePanel from '../components/GoogleDrivePanel'
import WorkspaceSidebar from '../components/WorkspaceSidebar'

export default function DrivePage() {
  return (
    <main className="workspace-with-sidebar">
      <WorkspaceSidebar />
      <section className="workspace-page">
        <header className="workspace-page-heading"><h1>Google Drive</h1><p>Connect your personal Drive and manage VoiceDocs files from one place.</p></header>
        <GoogleDrivePanel />
        <div className="drive-library-grid">
          <article className="drive-library-card"><span><AudioLines size={20} /></span><h2>Audio files</h2><p>Recordings uploaded to your Google Drive are listed in the Audio section.</p><a href="/audio">Open audio library</a></article>
          <article className="drive-library-card"><span><FileText size={20} /></span><h2>Documents</h2><p>Drive document storage is the next storage integration. Existing documents continue using the current VoiceDocs document API until migration is implemented.</p><span className="drive-coming-soon"><ShieldCheck size={14}/> Storage migration pending</span></article>
        </div>
      </section>
    </main>
  )
}
