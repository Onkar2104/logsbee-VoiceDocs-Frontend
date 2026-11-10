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

export async function fetchRecordings(page = 1, pageSize = 10) {
  const response = await api.get('/recordings', {
    params: { page, page_size: pageSize },
  })
  return response.data
}

export async function backupRecording(recordingId) {
  const response = await api.post(`/recordings/${recordingId}/backup`)
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

export async function uploadBrowserRecording(formData, options = {}) {
  const params = {}
  if (options.duration != null) params.duration = options.duration
  if (options.language) params.language = options.language
  if (options.documentId) formData.append('document_id', options.documentId)
  const response = await api.post('/recordings/upload', formData, {
    params,
    timeout: 0,
    // Let the browser add the multipart boundary; the shared API client defaults to JSON.
    headers: { 'Content-Type': undefined },
  })
  return response.data
}


export async function backupPendingFiles() {
  const response = await api.post('/google-drive/backup-pending', {}, { timeout: 0 })
  return response.data
}
