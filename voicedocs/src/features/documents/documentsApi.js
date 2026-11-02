import { api } from '../../lib/api'

export async function fetchDocuments() {
  const response = await api.get('/documents/')
  return response.data
}

export async function createDocument(payload) {
  const response = await api.post('/documents/', payload)
  return response.data
}

export async function deleteDocument(documentId) {
  const response = await api.delete(`/documents/${documentId}`)
  return response.data
}
