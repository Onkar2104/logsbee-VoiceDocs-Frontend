import { api } from '../../lib/api'

export async function connectGoogleDrive() {
  const response = await api.get('/google-drive/connect')
  return response.data
}

export async function fetchGoogleDriveStatus() {
  const response = await api.get('/google-drive/status')
  return response.data
}

export async function disconnectGoogleDrive() {
  const response = await api.delete('/google-drive/disconnect')
  return response.data
}

export async function fetchRecordings() {
  const response = await api.get('/recordings')
  return response.data
}

export async function fetchRecordingContent(recordingId) {
  const response = await api.get(`/recordings/${recordingId}/content`, {
    responseType: 'blob',
    timeout: 0,
  })
  return response.data
}

export async function deleteRecording(recordingId) {
  const response = await api.delete(`/recordings/${recordingId}`)
  return response.data
}
