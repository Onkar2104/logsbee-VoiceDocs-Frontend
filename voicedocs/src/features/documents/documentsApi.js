import { api } from '../../lib/api'

export async function fetchDocuments(scope = 'my', page = 1, pageSize = 10, filters = {}) {
  const response = await api.get('/documents/', {
    params: {
      scope,
      page,
      page_size: pageSize,
      search: filters.search || undefined,
      legal_category: filters.legalCategory || undefined,
      document_type: filters.documentType || undefined,
    },
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

export async function checkLegalDraftCompleteness(documentId) {\n  const response = await api.post(`/documents/${documentId}/legal-draft-preflight`)\n  return response.data\n}\n\nexport async function formatDocument(documentId, options = {}) {
  // Formatting may take longer than the normal 15-second API timeout.
  // Keep the request open long enough for the backend's longer model timeout and retry window.
  const response = await api.post(`/documents/${documentId}/format`, options, { timeout: 750000 })
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
export async function exportDocumentDocx(documentId, contentHtml) {
  const response = await api.post(
    `/documents/${documentId}/export/docx`,
    { content_html: contentHtml },
    {
      responseType: 'blob',
      timeout: 60000,
      headers: { Accept: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    },
  )
  return response.data
}

export async function fetchLegalDocumentCatalog() {
  const response = await api.get('/documents/legal-catalog')
  return response.data
}

export async function fetchDocumentTrash(page = 1, pageSize = 10) {
  const response = await api.get('/documents/trash', { params: { page, page_size: pageSize } })
  return response.data
}

export async function restoreDocument(documentId) {
  const response = await api.post(`/documents/${documentId}/restore`)
  return response.data
}

export async function permanentlyDeleteDocument(documentId) {
  const response = await api.delete(`/documents/${documentId}/permanent`)
  return response.data
}

export async function fetchDeletedDocumentVersions(documentId) {
  const response = await api.get(`/documents/${documentId}/version-trash`)
  return response.data
}

export async function deleteDocumentVersion(documentId, versionId) {
  const response = await api.delete(`/documents/${documentId}/versions/${versionId}`)
  return response.data
}

export async function restoreDocumentVersion(documentId, versionId) {
  const response = await api.post(`/documents/${documentId}/versions/${versionId}/restore`)
  return response.data
}

export async function permanentlyDeleteDocumentVersion(documentId, versionId) {
  const response = await api.delete(`/documents/${documentId}/versions/${versionId}/permanent`)
  return response.data
}

export async function fetchAllDeletedDocumentVersions() {
  const response = await api.get('/documents/version-trash')
  return response.data
}
