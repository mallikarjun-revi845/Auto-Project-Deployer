# Auto Project Deployer

Paste a public GitHub repository URL, and the app detects the project type, checks whether it can actually run on the
web, deploys supported projects to Vercel, and **verifies the generated URL responds before reporting success**.

- **Supported (v1):** React + Vite, Next.js, static HTML/CSS/JS websites → deployed to Vercel
- **Detected as unsupported:** Python desktop apps (OpenCV / `cv2.VideoCapture`, Tkinter, PyQt/PySide, pygame,
  MediaPipe, Kivy), Python web apps, Node servers, Create React App, unknown projects — each with a clear reason
- No fake results: a deployment is only marked `live` after an HTTP request to the deployment URL succeeds

## Stack

| Layer    | Technology |
| -------- | ---------- |
| Frontend | React, Vite, Tailwind CSS, React Router, Axios, Socket.IO client, Framer Motion, Lucide icons |
| Backend  | Node.js, Express, MongoDB + Mongoose, JWT, Passport (`passport-github2`), Socket.IO, Axios |
| Deploys  | Vercel REST API (file upload + `/v13/deployments`), GitHub REST API |

## Project structure

```
auto-project-deployer/
├── client/                     # React + Vite frontend
│   └── src/
│       ├── components/         # Header, progress, result, logo, route guard
│       ├── context/AuthContext.jsx
│       ├── lib/                # axios client, socket client, shared helpers
│       └── pages/              # Landing, Login, AuthCallback, Dashboard, History
└── server/
    ├── index.js
    ├── config/                 # env, db, passport, socket
    ├── controllers/deployController.js
    ├── middleware/auth.js
    ├── models/                 # User.js, Deployment.js
    ├── routes/                 # auth.js, deploy.js
    ├── services/               # githubService, projectDetector, vercelService, repoArchiveService
    └── test/                   # detector unit tests (node:test)
```

## Prerequisites

- Node.js 18+ and npm
- MongoDB (local `mongod`, or a free MongoDB Atlas cluster)
- A GitHub OAuth App
- A Vercel account + personal access token

### 1. Create the GitHub OAuth App

1. Go to <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**
2. Homepage URL: `http://localhost:5173`
3. Authorization callback URL: `http://localhost:5000/api/auth/github/callback`
4. Copy the **Client ID** and generate a **Client Secret**

### 2. Create the Vercel token

1. Go to <https://vercel.com/account/tokens> → **Create Token** (scope: your personal account or team)
2. Copy the token. If it belongs to a team, also copy the team ID from the team settings page.

## Setup

```bash
git clone <this-repo>
cd auto-project-deployer

# install dependencies for both apps
npm run install:all      # or: npm install --prefix server && npm install --prefix client

# backend env
cp server/.env.example server/.env
# then fill in MONGO_URI, JWT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, VERCEL_TOKEN

# frontend env (optional; defaults to http://localhost:5000)
cp client/.env.example client/.env
```

`server/.env` values:

| Variable | Description |
| -------- | ----------- |
| `PORT` | API port (default `5000`) |
| `CLIENT_URL` | Frontend origin, used for CORS + OAuth redirect (`http://localhost:5173`) |
| `MONGO_URI` | e.g. `mongodb://127.0.0.1:27017/auto-project-deployer` |
| `JWT_SECRET` | Long random string (`openssl rand -hex 32`) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | From the GitHub OAuth App |
| `GITHUB_CALLBACK_URL` | `http://localhost:5000/api/auth/github/callback` |
| `VERCEL_TOKEN` | Vercel personal access token |
| `VERCEL_TEAM_ID` | Only when the token belongs to a team |

## Run locally

```bash
# terminal 1 — API on http://localhost:5000
npm run dev --prefix server

# terminal 2 — frontend on http://localhost:5173
npm run dev --prefix client
```

Or both at once (installs `concurrently` at the repo root first):

```bash
npm install
npm run dev
```

Open <http://localhost:5173>, click **Login with GitHub**, then paste a repository URL on the dashboard.

## Tests & lint

```bash
npm test --prefix server    # project detection unit tests
npm run lint --prefix server
npm run lint --prefix client
npm run build --prefix client
```

## How a deployment works

1. **validating** – URL format is validated, then the repository is fetched from the GitHub API
   (404 → "repository not found", private repos are rejected with an explicit message)
2. **detecting** – the full file tree is read; `package.json`, `vite.config.*`, `next.config.*`, `index.html`,
   `requirements.txt` and `.py` sources are inspected to classify the project
3. **checking** – unsupported projects stop here with a reason (e.g. desktop application detected)
4. **cloning** – the repository tarball is downloaded and extracted server-side
5. **deploying** – every file is uploaded to Vercel (`POST /v2/files`, SHA-1 content addressing), then a production
   deployment is created (`POST /v13/deployments`) with the detected framework preset
6. **building** – the deployment is polled through `QUEUED → INITIALIZING → BUILDING → READY | ERROR | CANCELED`
7. **verifying** – an HTTP request is made to the generated URL, retried a few times
8. **live** – only reported when the site responded with a 2xx/3xx status. If Vercel says READY but the URL fails,
   the deployment is marked failed with:
   *"Vercel reported the deployment as ready, but the generated website could not be accessed."*

Every step is persisted to MongoDB and emitted over Socket.IO (`validating`, `detecting`, `checking`, `cloning`,
`building`, `deploying`, `verifying`, `live`, `failed`, plus a combined `deployment:update` event). The dashboard also
falls back to HTTP polling if the socket disconnects.

## API

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/auth/github` | Start GitHub OAuth |
| `GET` | `/api/auth/github/callback` | OAuth callback → redirects to the client with a JWT |
| `GET` | `/api/auth/me` | Current user (JWT required) |
| `POST` | `/api/auth/logout` | Logout |
| `POST` | `/api/deploy` | Start a deployment `{ repoUrl, projectName? }` (JWT required) |
| `POST` | `/api/deploy/analyze` | Detect the project type without deploying |
| `GET` | `/api/deploy/history` | Deployment history for the current user |
| `GET` | `/api/deploy/:id` | Single deployment |

## Security notes

- All secrets live in `server/.env`, which is git-ignored along with `node_modules` and `dist`
- Deployment endpoints require a valid JWT; Socket.IO connections are authenticated with the same token and each user
  only receives events in their own room
- GitHub URLs are validated against a strict pattern before any network call
- The GitHub access token is stored with `select: false` and is never returned by the API

## Error handling

Invalid URLs, missing repositories, private repositories, unsupported project types, Vercel API errors, build
failures, network errors, deployment timeouts (10 min) and unreachable deployment URLs all surface the real error
message in the dashboard and in the deployment history.
