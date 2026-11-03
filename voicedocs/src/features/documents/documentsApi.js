import { api } from '../../lib/api'

export async function fetchDocuments(scope = 'my') {
  const response = await api.get('/documents/', { params: { scope } })
  return response.data
}

export async function fetchDocument(documentId) {
  const response = await api.get(`/documents/${documentId}`)
  return response.data
}

export async function createDocument(payload) {
  const response = await api.post('/documents/', payload)
  return response.data
}

export async function requestDocumentEditAccess(documentId) {
  const response = await api.post(`/documents/${documentId}/edit-requests`)
  return response.data
}

export async function updateDocument(documentId, payload) {
  const response = await api.put(`/documents/${documentId}`, payload)
  return response.data
}

export async function deleteDocument(documentId) {
  const response = await api.delete(`/documents/${documentId}`)
  return response.data
}

export async function fetchSharingSummary() {
  const response = await api.get('/documents/sharing-summary')
  return response.data
}

export async function transcribeAudio(formData, language = '') {
  const response = await api.post('/transcriptions/', formData, {
    params: language ? { language } : {},
    timeout: 0,
  })
  return response.data
}
