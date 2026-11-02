import { api } from '../../lib/api'

// Backend API_V1_PREFIX=/api, and the current-user route is /me.
export async function fetchCurrentUser() {
  const response = await api.get('/me')
  return response.data
}
