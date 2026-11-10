import { api } from '../../lib/api'

export async function fetchUserPreferences() {
  const response = await api.get('/preferences/')
  return response.data
}

export async function updateUserPreferences(payload) {
  const response = await api.put('/preferences/', payload)
  return response.data
}


export async function requestTwoFactorOtp() {
  const response = await api.post('/preferences/two-factor/request')
  return response.data
}

export async function verifyTwoFactorOtp(otp) {
  const response = await api.post('/preferences/two-factor/verify', { otp })
  return response.data
}

export async function disableTwoFactor() {
  const response = await api.delete('/preferences/two-factor')
  return response.data
}
