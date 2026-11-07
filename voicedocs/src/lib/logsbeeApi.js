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

// The Logsbee User service owns authentication and the canonical user profile.
let logsbeeAccessToken = typeof window !== 'undefined' ? window.localStorage.getItem('voicedocs_access_token') : null

export function setLogsbeeAccessToken(token) {
  logsbeeAccessToken = token || null
  if (typeof window !== 'undefined') {
    if (logsbeeAccessToken) window.localStorage.setItem('voicedocs_access_token', logsbeeAccessToken)
    else window.localStorage.removeItem('voicedocs_access_token')
  }
}

export function clearLogsbeeAccessToken() {
  logsbeeAccessToken = null
  if (typeof window !== 'undefined') window.localStorage.removeItem('voicedocs_access_token')
}

logsbeeApi.interceptors.request.use((config) => {
  if (logsbeeAccessToken) {
    config.headers.Authorization = `Bearer ${logsbeeAccessToken}`
  }
  return config
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

export async function registerAccount(payload) {
  const response = await logsbeeApi.post('/accounts/register', payload)
  return response.data
}

export async function resendRegistrationOtp(accountId, verificationType) {
  const response = await logsbeeApi.post('/accounts/register/resend-otp', {
    account_id: accountId,
    verification_type: verificationType,
  })
  return response.data
}

export async function verifyAccountEmail(accountId, otp) {
  const response = await logsbeeApi.post('/accounts/register/verify-account-email', {
    account_id: accountId,
    otp,
  })
  return response.data
}

export async function verifyRegistrationEmail(userId, otp) {
  const response = await logsbeeApi.post(`/users/${userId}/verification/email`, { otp })
  return response.data
}
