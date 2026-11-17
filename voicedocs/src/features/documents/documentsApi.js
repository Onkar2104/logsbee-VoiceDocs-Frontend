import { api } from '../../lib/api'

export async function fetchDocuments(scope = 'my', page = 1, pageSize = 10) {
  const response = await api.get('/documents/', {
    params: { scope, page, page_size: pageSize },
  })
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

export async function backupDocument(documentId) {
  const response = await api.post(`/documents/${documentId}/backup`)
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

export async function formatDocument(documentId) {
  // Formatting may take longer than the normal 15-second API timeout.
  // Keep the request open long enough for the backend's longer model timeout and retry window.
  const response = await api.post(`/documents/${documentId}/format`, null, { timeout: 240000 })
  return response.data
}

export async function fetchDocumentVersions(documentId) {
  const response = await api.get(`/documents/${documentId}/versions`)
  return response.data
}

export async function fetchDocumentVersion(documentId, versionId) {
  const response = await api.get(`/documents/${documentId}/versions/${versionId}`)
  return response.data
}

export async function replaceDocumentVersion(documentId, versionId, contentHtml) {
  const response = await api.put(`/documents/${documentId}/versions/${versionId}`, { content_html: contentHtml })
  return response.data
}

export async function setActiveDocumentVersion(documentId, versionId) {
  const response = await api.patch(`/documents/${documentId}/active-version/${versionId}`)
  return response.data
}

export async function backupDocumentVersion(documentId, versionId) {
  const response = await api.post(`/documents/${documentId}/versions/${versionId}/backup`)
  return response.data
}
export async function createDocumentVersion(documentId, contentHtml) {
  const response = await api.post(`/documents/${documentId}/versions`, { content_html: contentHtml })
  return response.data
}