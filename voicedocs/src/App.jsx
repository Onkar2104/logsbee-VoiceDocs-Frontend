import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardPage from './pages/DashboardPage'
import DocumentPage from './pages/DocumentPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import DrivePage from './pages/DrivePage'
import AudioPage from './pages/AudioPage'
import SettingsPage from './pages/SettingsPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/documents" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/documents/new" element={<ProtectedRoute><DocumentPage /></ProtectedRoute>} />
          <Route path="/documents/:documentId" element={<ProtectedRoute><DocumentPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/drive" element={<ProtectedRoute><DrivePage /></ProtectedRoute>} />
          <Route path="/audio" element={<ProtectedRoute><AudioPage /></ProtectedRoute>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
