import axios from 'axios'
import { env } from '../config/env'

export const api = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

// Persist the access token so a browser refresh does not discard the session.
const ACCESS_TOKEN_STORAGE_KEY = 'voicedocs_access_token'
let accessToken = typeof window !== 'undefined' ? window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) : null

export function setAccessToken(token) {
  accessToken = token || null
  if (typeof window !== 'undefined') {
    if (accessToken) window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken)
    else window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  }
}

export function clearAccessToken() {
  accessToken = null
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

export function getApiErrorMessage(error) {
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail
    return typeof detail === 'string' ? detail : JSON.stringify(detail)
  }

  if (error.code === 'ECONNABORTED') {
    return 'The API request timed out. Please try again.'
  }

  if (!error.response) {
    return 'Unable to reach the VoiceDocs API. Check the backend URL and server status.'
  }

  return error.message || 'An unexpected API error occurred.'
}
