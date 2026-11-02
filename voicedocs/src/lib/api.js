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

// Keep the token in memory for now. A later authentication phase can replace
// this with the chosen secure persistence/refresh strategy.
let accessToken = null

export function setAccessToken(token) {
  accessToken = token || null
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
