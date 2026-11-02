import { api } from '../../lib/api'

// Backend API_V1_PREFIX=/api and the current-user route is /v1/me.
export async function fetchCurrentUser() {
  const response = await api.get('/v1/me')
  return response.data
}
