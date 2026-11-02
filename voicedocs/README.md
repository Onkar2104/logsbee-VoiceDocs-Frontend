# VoiceDocs Frontend

React + Vite frontend for VoiceDocs.

## Requirements

- Node.js compatible with the Vite version in `package.json`
- npm

## Setup

Run these commands from the `voicedocs` directory:

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, copy the environment file with:

```powershell
Copy-Item .env.example .env
```

## API configuration

The VoiceDocs backend is configured with:

```env
API_V1_PREFIX=/api
```

Set the frontend environment variable to the matching API base URL:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

The frontend appends the route path used by the backend. For example, the current-user endpoint is:

```
GET /api/me
```

For a deployed backend, replace the local origin with the deployed backend URL and retain the `/api` suffix.

## Available scripts

```bash
npm run dev
npm run lint
npm run build
npm run preview
```

## Current API integration foundation

- Shared Axios client with configurable API base URL.
- Bearer-token request support through `setAccessToken(token)`.
- Token clearing through `clearAccessToken()`.
- Current-user API function for `GET /api/me`.
- Common API error-message extraction.
