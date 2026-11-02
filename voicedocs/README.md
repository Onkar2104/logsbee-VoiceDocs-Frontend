# VoiceDocs Frontend

React + Vite frontend for VoiceDocs.

## Requirements

- Node.js compatible with the Vite version in `package.json`
- npm

## Setup

From PowerShell:

```powershell
cd voicedocs
npm install
Copy-Item .env.example .env
npm run dev
```

## Local services

Run both backend services before signing in:

- VoiceDocs backend: `http://127.0.0.1:8000`
- Logsbee User Management API: `http://127.0.0.1:8001`

The local frontend uses these values in `.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
VITE_LOGSBEE_API_BASE_URL=http://127.0.0.1:8001/api
```

The VoiceDocs backend has `API_V1_PREFIX=/api`. Its authenticated current-user endpoint is `GET /api/me`. Logsbee login endpoints are:

- `POST /api/auth/login/password`
- `POST /api/auth/login/verify-otp`

If your backend ports differ, update the two Vite environment variables and restart Vite.

## Authentication flow

1. The frontend sends email and password to Logsbee.
2. If Logsbee returns `requires_2fa=true`, the UI asks for the email OTP and submits the challenge ID and OTP.
3. After authentication, the access token is held in memory and sent as a Bearer token to VoiceDocs.
4. VoiceDocs validates that token through Logsbee and returns the current user context from `GET /api/me`.
5. The protected dashboard displays the user's name, email, role, account, and email-verification status.

The access token is intentionally memory-only in this first implementation. Reloading the browser clears the session and requires signing in again. Refresh-token renewal and a persistent session strategy are not implemented yet.

## CORS

Allow the Vite development origin (normally `http://localhost:5173`) in both backend CORS configurations. If you use a different Vite port, allow that exact origin.

## Available scripts

```bash
npm run dev
npm run lint
npm run build
npm run preview
```

## Implemented in this branch

- Shared Axios client for VoiceDocs API calls.
- Separate Logsbee API client for login and OTP verification.
- Password login and optional email OTP verification.
- In-memory Bearer token forwarding.
- Current-user fetch and protected dashboard route.
- Sign out and API error messaging.
