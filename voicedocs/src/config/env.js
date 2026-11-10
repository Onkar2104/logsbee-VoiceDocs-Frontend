const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/api'
const DEFAULT_LOGSBEE_API_BASE_URL = 'http://127.0.0.1:8000/api'

function normalizeBaseUrl(value, fallback) {
  return (value || fallback).trim().replace(/\/+$/, '')
}

export const env = Object.freeze({
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL, DEFAULT_API_BASE_URL),
  logsbeeApiBaseUrl: normalizeBaseUrl(
    import.meta.env.VITE_LOGSBEE_API_BASE_URL,
    DEFAULT_LOGSBEE_API_BASE_URL,
  ),
})
