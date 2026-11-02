const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/api'

function normalizeBaseUrl(value) {
  return (value || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '')
}

export const env = Object.freeze({
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL),
})
