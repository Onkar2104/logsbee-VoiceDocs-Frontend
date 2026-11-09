import { NavLink } from 'react-router-dom'
import { AudioLines, FileText, HardDrive, House, LogOut, Settings, UserRound } from 'lucide-react'
import { useAuth } from '../context/useAuth'

const links = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/audio', label: 'Audio', icon: AudioLines },
  { to: '/drive', label: 'Google Drive', icon: HardDrive },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/settings', label: 'User settings', icon: Settings },
]

export default function WorkspaceSidebar() {
  const { user, logout } = useAuth()
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'User'
  const organization = user?.account?.name || 'Workspace'
  return (
    <aside className="workspace-sidebar">
      <NavLink className="workspace-sidebar-brand" to="/" aria-label="VoiceDocs home">
        <span className="brand-mark brand-mark-small">V</span><span>VoiceDocs</span>
      </NavLink>
      <nav className="workspace-sidebar-nav" aria-label="Main navigation">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `workspace-sidebar-link ${isActive ? 'active' : ''}`}>
            <Icon size={18} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="workspace-sidebar-bottom">
        <div className="workspace-user-chip">
          <span className="workspace-user-avatar">{name.charAt(0).toUpperCase()}</span>
          <div className="workspace-user-copy"><strong>{name}</strong><span>{organization}</span></div>
        </div>
        <button className="workspace-logout" type="button" onClick={logout}><LogOut size={16} /> Sign out</button>
      </div>
    </aside>
  )
}
