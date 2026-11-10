import { api } from '../../lib/api'

export async function fetchUserPreferences() {
  const response = await api.get('/preferences/')
  return response.data
}

export async function updateUserPreferences(payload) {
  const response = await api.put('/preferences/', payload)
  return response.data
}
