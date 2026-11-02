import axios from 'axios'
import { env } from '../config/env'

export const logsbeeApi = axios.create({
  baseURL: env.logsbeeApiBaseUrl,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

export async function loginWithPassword({ email, password }) {
  const response = await logsbeeApi.post('/auth/login/password', {
    email,
    password,
  })
  return response.data
}

export async function verifyLoginOtp({ challengeId, otp }) {
  const response = await logsbeeApi.post('/auth/login/verify-otp', {
    challenge_id: challengeId,
    otp,
  })
  return response.data
}

export async function refreshLogsbeeToken(refreshToken) {
  const response = await logsbeeApi.post('/auth/login/refresh', {
    refresh_token: refreshToken,
  })
  return response.data
}
