import { logsbeeApi } from '../../lib/logsbeeApi'

// The canonical user profile, including full organization details, belongs
// to Logsbee User (VITE_LOGSBEE_API_BASE_URL), not the VoiceDocs document API.
export async function fetchCurrentUser() {
  const response = await logsbeeApi.get('/users/me')
  return response.data
}
