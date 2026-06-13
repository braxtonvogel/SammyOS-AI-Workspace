# Sammy OS — AI Desktop Workspace

**A native desktop AI workspace built with Tauri + Next.js + Rust**

[![Live Dashboard](https://img.shields.io/badge/Live%20Dashboard-sammyos--live.vercel.app-6366f1?style=flat-square)](https://sammyos-live.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-nexus--analyzer-black?style=flat-square&logo=vercel)](https://nexus-analyzer-three.vercel.app)

> **Note:** This project was previously named NexusOS. It was renamed to SammyOS on May 31, 2026. The backend service (`nexus-analyzer`) and its related env vars retain the `NEXUS_` prefix intentionally.

---

## What Is Sammy OS?

Sammy OS is a **native Windows desktop AI workspace** — not a web app. It runs as a real application window powered by Tauri and embeds a full Next.js frontend with a Rust backend for OS-level capabilities. The central AI assistant is named **Sam**.

**Sam can simultaneously:**
- See your screen in real time (via xcap screen capture)
- Hear your voice and meeting audio (Web Audio API + Groq Whisper transcription)
- Read any files or codebases you upload to the Knowledge Vault (local-only, never leaves your machine)
- Conduct deep autonomous AI research and save reports directly to your vault
- Answer questions about all of the above at once, in a floating window that overlays any app

Users authenticate with accounts and can optionally provide their own API keys (OpenAI, Anthropic, Groq, or any OpenAI-compatible endpoint) for priority routing with automatic fallback to the free provider rotation.

**Developer:** Braxton Vogel — Sam Houston State University, Major GPA 4.0
**Live usage dashboard:** [sammyos-live.vercel.app](https://sammyos-live.vercel.app)
**Portfolio:** [braxtonvogel.com](https://braxtonvogel.com)

---

## Features

**AI Chat & Context**
- Multi-turn chat with full conversation history shared across all three interfaces (float window, Chat tab, Sam sidebar)
- Sam automatically decides when to search the web, inject vault context, or use a screenshot
- Floating chat window (`Sam (AI)`) overlays any application — works during calls, coding sessions, anything
- Vision support: attach screenshots (Tauri xcap — no `getDisplayMedia` limitations) or have Sam watch a live screen share
- Push-to-talk voice input via Groq Whisper transcription

**Knowledge Vault**
- Upload individual files (PDF, text, code) or entire project folders for AI analysis
- Vault contents are machine-local only — never sent to any server, never stored in the cloud
- Folder analysis via distributed cloud job queue (QStash + nexus-analyzer on Vercel)
- Research reports are automatically saved to the vault on completion

**Autonomous Research**
- Sam decomposes any topic into 5–8 sub-questions, researches each independently, then synthesizes a full markdown report
- Built around Vercel's 60-second function limit via a chunked job architecture (one sub-question per advance call)
- Animated Three.js globe on the Research tab while research is running
- Web search via Brave Search API with DuckDuckGo as a free fallback (zero configuration needed)

**IdeaBoard**
- Canvas-style draggable idea cards with SVG Bézier connection lines
- Tags: IDEA (indigo), TODO (amber), BUG (red), NOTE (emerald)
- Persisted to `localStorage` (key: `sammy-idea-board-v2`)

**Authentication & API Keys**
- Account registration + login backed by Upstash Redis via nexus-analyzer
- 30-day session tokens stored in localStorage
- Optional user-owned API keys (OpenAI, Anthropic, Groq, or custom OpenAI-compatible endpoint) stored encrypted in Redis
- Provider priority: Custom Key → Ollama → Groq → Gemini → Cerebras

**Screen + Workspace Awareness**
- OS-level active window detection via `active-win-pos-rs` (polls every 800ms, emits `active-window` Tauri events)
- "Attach mode" — tell Sam to specifically watch VS Code, a browser, or any other window
- Float window screen capture hides the float, waits 250ms for the compositor to flush, captures with xcap, then shows itself again

**Silent Launcher (Windows)**
- `SammyOS.vbs` — double-click, no cmd window ever visible
- `launch.py` — checks Node.js ≥18, npm, Rust/Cargo, Tauri CLI, and npm deps; pulls updates from GitHub; launches via Windows Task Scheduler for full process-tree detachment
- Self-writes `launcher_helper.vbs` on each run (auto-generated, not committed)
- Empty-repo safety guard prevents `git pull` from wiping local files if GitHub repo is ever empty

**Live Portfolio Dashboard**
- Public real-time metrics at [sammyos-live.vercel.app](https://sammyos-live.vercel.app)
- Shows: active users (last 5 min), total sessions, messages sent, research jobs started, vault uploads, 7-day message chart, feature breakdown
- Auto-refreshes every 10 seconds — no login required

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop runtime | Tauri 2 |
| Frontend | Next.js 15.3.8, TypeScript, Tailwind CSS |
| Rust backend | `active-win-pos-rs`, `xcap`, `base64`, `image`, `serde` |
| State management | Zustand |
| AI providers | Groq (primary), Gemini, Cerebras, Ollama, any OpenAI-compatible endpoint |
| Local AI | Ollama (optional — unlimited inference for users with capable hardware) |
| PDF parsing | `unpdf` (not pdf-parse — do not reinstall pdf-parse) |
| 3D globe | Three.js |
| Cloud backend | Next.js API routes on Vercel (nexus-analyzer) |
| Database | Upstash Redis (auth, telemetry, job queue) |
| Job queue | QStash (async research + vault analysis) |
| Auth hashing | bcryptjs (installed in nexus-analyzer only, not the monorepo root) |

---

## Monorepo Structure

```
SammyOS/                          ← Repo root
├── SammyOS.vbs                   ← Double-click launcher (silent, no cmd window)
├── launch.py                     ← Launcher logic (deps check, update, launch)
├── launcher.log                  ← Auto-generated each run — do not create manually
├── launcher_helper.vbs           ← Auto-generated by launch.py — do not create manually
└── apps/
    └── desktop/                  ← Main Tauri + Next.js application
        ├── src-tauri/
        │   ├── src/main.rs       ← All Tauri commands (screen capture, float window, etc.)
        │   ├── capabilities/     ← Tauri permission files
        │   └── tauri.conf.json
        ├── app/
        │   ├── page.tsx          ← Home / IdeaBoard
        │   ├── login/            ← Auth (register + login)
        │   ├── chat/             ← Full-page chat tab
        │   ├── vault/            ← Knowledge Vault
        │   ├── workspace/        ← Screen share + Sam sidebar
        │   ├── research/         ← Autonomous research + globe
        │   ├── settings/         ← Provider config + user API keys + account
        │   ├── chat-float/       ← Floating overlay window (separate WebviewWindow)
        │   └── api/              ← Next.js API routes (chat, vault, research, transcribe)
        ├── components/
        │   ├── layout/           ← SammyShell, ConditionalShell
        │   ├── chat/             ← ChatHistoryPanel
        │   ├── workspace/        ← ScreenShare, SamSidebar
        │   └── vault/            ← VaultUpload, FileCard, FolderCard, FileViewerModal
        └── lib/
            ├── auth-store.ts     ← Zustand auth store (localStorage: sammy-user)
            ├── use-chat-history.ts
            ├── vault-store.ts
            ├── research-store.ts
            ├── use-telemetry.ts
            └── sam-brain.ts / sam-intent.ts
```

The `nexus-analyzer` backend and `sammyos-live` dashboard are **separate projects** deployed independently on Vercel. They are not in this repository.

- **nexus-analyzer:** [nexus-analyzer-three.vercel.app](https://nexus-analyzer-three.vercel.app) — handles auth, API key storage, vault/research job queue, and telemetry
- **sammyos-live:** [sammyos-live.vercel.app](https://sammyos-live.vercel.app) — public real-time usage dashboard

---

## Prerequisites

Before running SammyOS, you need:

- **Node.js v18+** — [nodejs.org](https://nodejs.org) (LTS recommended)
- **Rust + Cargo** — [rustup.rs](https://rustup.rs) — install via `rustup-init.exe` on Windows, check "Add to PATH"
- **Python 3** (for the launcher only) — [python.org](https://python.org) — check "Add Python to PATH" during install
- **Git** — for the launcher's auto-update feature

The launcher (`SammyOS.vbs`) will check for Node, Rust, Tauri CLI, and npm deps on every launch and install anything missing automatically. Python and Git are the only hard manual prerequisites.

---

## Installation

```powershell
git clone https://github.com/braxtonvogel/SammyOS-AI-Workspace.git
cd SammyOS-AI-Workspace
```

Then set up your environment variables (see next section), and either double-click `SammyOS.vbs` or run manually:

```powershell
cd apps\desktop
npm install
npm run tauri dev
```

---

## Environment Variables

Create `apps/desktop/.env.local` with the following:

```env
# ── AI Providers ──────────────────────────────────────────────
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=...
GOOGLE_API_KEY=...            # Same value as GEMINI_API_KEY
CEREBRAS_API_KEY=csk-...

# ── Backend ───────────────────────────────────────────────────
NEXUS_ANALYZER_URL=https://nexus-analyzer-three.vercel.app
NEXT_PUBLIC_NEXUS_ANALYZER_URL=https://nexus-analyzer-three.vercel.app
NEXUS_SECRET=<your-secret>    # ⚠️ Must match nexus-analyzer Vercel env var

# ── Optional ──────────────────────────────────────────────────
BRAVE_API_KEY=...             # Web search — DDG used as free fallback if omitted
```

**Critical notes:**

- `NEXT_PUBLIC_NEXUS_ANALYZER_URL` is required **in addition to** `NEXUS_ANALYZER_URL`. Next.js only exposes `NEXT_PUBLIC_`-prefixed variables to client-side code — without it, telemetry silently fails hitting `undefined/api/telemetry`.
- `GEMINI_API_KEY` and `GOOGLE_API_KEY` hold the same credential. The route reads `GEMINI_API_KEY` specifically.
- `NEXUS_SECRET` must match the value set in nexus-analyzer's Vercel environment variables. Both sides use it to authenticate internal requests.
- Ollama model and server URL are stored in `.provider-config.json` — not in `.env.local`.

---

## Running the App

**Recommended — double-click launcher:**
```
SammyOS.vbs  (in the repo root)
```
Silently checks all dependencies, pulls updates from GitHub, and launches. Check `launcher.log` if anything seems wrong.

**Manual dev launch:**
```powershell
cd apps\desktop
npm run tauri dev
```

**Troubleshooting:**
```powershell
# Stale Tauri build cache (permission errors, path errors):
Remove-Item -Recurse -Force apps\desktop\src-tauri\target\debug\build
npm run tauri dev

# Next.js compile issues:
Remove-Item -Recurse -Force apps\desktop\.next
npm run tauri dev

# Fix Rust import warnings:
cd apps\desktop\src-tauri
cargo fix --bin "app" -p app --allow-dirty
```

> **PowerShell note:** `rd /s /q` is CMD syntax and throws an error in PowerShell. Always use `Remove-Item -Recurse -Force "<path>"`. The `npm run tauri dev` command must be run from `apps\desktop`, not the repo root.

---

## Tauri Commands (Rust Backend)

The Rust backend in `src-tauri/src/main.rs` registers these commands:

| Command | Purpose |
|---|---|
| `attach_window(app_name)` | Tell Sam to specifically track a named application |
| `get_open_windows()` | Returns the currently active OS window info |
| `capture_screen()` | Captures primary monitor, returns base64 PNG string |
| `float_chat()` | Spawns the `sam-float` WebviewWindow at `/chat-float` |
| `close_float()` | Closes the float window |
| `set_float_always_on_top(on_top)` | Pin float above all other apps |
| `set_float_content_protection(protected)` | Hide float from screen recorders |
| `minimize_float()` | Minimize float independently from the main window |

A background loop polls for the active OS window every 800ms and emits `active-window` Tauri events to the frontend.

**Critical Tauri config notes:**
- `"withGlobalTauri": true` in `tauri.conf.json` is required — without it, `data-tauri-drag-region` is silently ignored and float window dragging breaks
- Correct Rust method: `win.set_content_protected(protected)` — NOT `set_content_protection`
- Correct capability name: `core:window:allow-set-content-protected` — NOT `allow-set-content-protection`
- Do NOT register `chat_send` in `generate_handler![]` — that command was removed; registering it causes a build error

---

## AI Provider Chain

Sam's chat route tries providers in this order, falling back automatically on any error:

```
Custom Key (user-provided, any OpenAI-compatible endpoint)
  → Ollama (local, if enabled in Settings)
    → Groq (llama-4-scout — vision + large context, fastest free inference)
      → Gemini
        → Cerebras
```

Users can add their own API key in Settings → "Your Own API Key". The custom key is tried first and stored encrypted in Redis via nexus-analyzer.

---

## Knowledge Vault

Vault files are **100% local**. They are stored in `apps/desktop/.vault-store.json` on the machine running the dev server and never leave the user's device. The only vault data that reaches any external service is an anonymous usage count (the number of times the vault upload feature has been used) sent to nexus-analyzer's telemetry endpoint.

Supported file types: PDF, plaintext, code files, and entire project folders (analyzed via QStash cloud jobs).

Folder analysis polls for job completion every 5 seconds with a 5-minute timeout (`MAX_ATTEMPTS = 60`). If a job stalls, the UI shows a timeout message rather than getting stuck forever.

---

## Authentication

Auth is handled by nexus-analyzer (Vercel) with Upstash Redis as the backing store.

**Auth flow:**
1. User opens SammyOS → `ConditionalShell` calls `hydrate()` → reads `sammy-user` from localStorage
2. If no user found after a 150ms hydration grace period → redirects to `/login`
3. On login/register → `setUser()` writes to `sammy-user` in localStorage → redirects to home
4. All chat requests include `x-sammy-token: user.token` in headers
5. `injectUserKeys(token)` is called server-side to use user's stored API keys if present
6. Sign Out: clears `sammy-user` from localStorage and redirects to `/login`

Chat history is stored in `localStorage` (key: `sammy-chats`) and is machine-local — it is not tied to accounts and is not synced to the cloud. All three chat interfaces (float window, Chat tab, Sam sidebar) share the same history via this key and sync across windows using the native browser `storage` event.

**Security hardening (as of v10):**
- Passwords hashed with bcrypt
- Register: rate-limited to 10 attempts per IP per hour; email format validation; minimum 8-character password
- Login: rate-limited to 10 attempts per IP per 15 minutes + per-account attempt counter (prevents proxy-rotation bypass)
- Session tokens: 30-day TTL in Redis
- User API keys: encrypted at rest in Redis
- CORS headers on all cross-origin routes (`/api/auth/*`, `/api/telemetry/*`, `/api/vault/*`)

---

## Telemetry

SammyOS sends anonymous usage pings to nexus-analyzer. The following events are tracked — **no message content, no file contents, and no personal data beyond an anonymous session token are ever included:**

| Event | When |
|---|---|
| `session_start` | App home page mounts |
| `message_sent` | Sam replies to a chat message |
| `research_started` | A research job is submitted |
| `vault_upload` | A file or folder is successfully uploaded to the vault |

All counters are visible on the public dashboard at [sammyos-live.vercel.app](https://sammyos-live.vercel.app).

**Testing the telemetry pipeline:**
```powershell
Invoke-RestMethod -Uri "https://nexus-analyzer-three.vercel.app/api/telemetry" `
  -Method POST -ContentType "application/json" `
  -Body '{"event":"session_start","feature":"chat"}'
# Expected: { ok: true }
```

---

## Gitignore — What Is Never Committed

The following files are gitignored and must never be committed:

`apps/desktop/.gitignore`:
```
.env.local
.vault-store.json
.pending-jobs.json
.research-store.json
.provider-config.json
```

Root `.gitignore`:
```
launcher.log
launcher_helper.vbs
```

**Before pushing to a public repository:**
1. Delete any local data files that may have been generated during development
2. Verify `.gitignore` entries are in place
3. Run `git ls-files | Select-String "\.env|vault-store|pending-jobs|research-store|provider-config"` — if anything appears, remove it with `git rm --cached`
4. **Rotate `NEXUS_SECRET`** in Vercel's dashboard for nexus-analyzer before any public push, then update your local `.env.local` to match
5. Scan git history: `git log --all -p | Select-String "your-old-secret-value"`

---

## Packages

### `apps/desktop`
```json
{
  "next": "15.3.8",
  "@tauri-apps/api": "^2.x",
  "unpdf": "latest",
  "zustand": "latest",
  "three": "latest"
}
```
> `pdf-parse` was replaced with `unpdf`. **Do not reinstall pdf-parse** — it fails with Turbopack ("not a function").

### `apps/desktop/src-tauri` (Cargo.toml)
```toml
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
active-win-pos-rs = "0.8"
xcap = "0.0.14"
base64 = "0.22"
image = "0.25"
```

### nexus-analyzer
```json
{
  "next": "latest",
  "@upstash/redis": "latest",
  "@upstash/qstash": "latest",
  "bcryptjs": "latest"
}
```
> `bcryptjs` must be installed inside the nexus-analyzer project directory — not in the monorepo root.

---

## Roadmap

- [ ] **Streaming responses** — Sam's reply appears all at once; Server-Sent Events would make words stream as they generate (highest-impact UX improvement remaining)
- [ ] **Float window button end-to-end test** — Pin, shield, minimize, and close buttons need verification in a fresh build
- [ ] **Sidebar live screen context** — Right sidebar currently screenshot-only; needs a global Zustand frame store that ScreenShare writes to
- [ ] **Memory system** — Sam remembering cross-conversation context via an append-only log in the vault
- [ ] **Research UI polish** — Smooth progress bar, estimated time remaining, "View Report" button that opens vault file inline on completion
- [ ] **IdeaBoard: manual link cards** — Currently cards auto-connect in creation order; allow dragging from a card edge to create custom graph edges
- [ ] **IdeaBoard: export to vault** — One-click "Save Ideas to Vault" that serializes all cards as markdown
- [x] **User API key management** — OpenAI, Anthropic, Groq, or custom endpoint; Sam tries user key first with automatic fallback *(completed)*
- [x] **Live portfolio dashboard** — sammyos-live.vercel.app *(completed)*
- [x] **Silent launcher** — SammyOS.vbs + launch.py with no cmd window *(completed)*
- [x] **Terms of Service + Privacy Policy**

---

## Known Architectural Decisions

A few non-obvious choices worth understanding before contributing:

- **`withGlobalTauri: true` is required** — without it the float window can't be dragged
- **`/chat-float` must be in `PUBLIC_PATHS`** — React effects don't respect early returns; the auth redirect `useEffect` in `ConditionalShell` fires regardless, so `PUBLIC_PATHS` is the only way to stop it
- **Float window calls `hydrate()` on mount** — it's a separate WebviewWindow with its own React tree and its own isolated `useAuthStore` instance; without this call, `user` is always null and `x-sammy-token` is never sent
- **150ms hydration grace period in `ConditionalShell`** — `hydrate()` reads from localStorage but runs after mount; the delay prevents a false redirect to `/login` on every page refresh
- **`useTelemetry` only inside page component bodies** — calling it at module scope or in `layout.tsx` / `conditional-shell.tsx` causes an "Invalid hook call" crash
- **No synthetic `StorageEvent` dispatch** — the native `storage` event only fires in OTHER windows; manually dispatching it in the same window causes duplicate chat session entries
- **`capture_screen` Tauri command (xcap) in float window** — `getDisplayMedia` requires an active browser gesture that is lost after `getCurrentWindow().hide()`
- **`NEXT_PUBLIC_` prefix on the nexus-analyzer URL** — Next.js strips non-prefixed vars from client bundles at build time; `use-telemetry.ts` is client-side code and silently hits `undefined/api/telemetry` without it
- **Vault ping uses full URL, not relative** — relative URLs in the Tauri app resolve to `http://localhost:3000`; there is no `/api/vault/ping` route on the local dev server
- **Task Scheduler + `launcher_helper.vbs`** — `npm run tauri dev` always spawns `cmd.exe` because npm is a `.cmd` file; `DETACHED_PROCESS`, `CREATE_NO_WINDOW`, and `shell=False` all fail; Task Scheduler breaks the parent-child process chain entirely

---

## License

This is a personal portfolio project by Braxton Vogel. See [Terms of Service](https://braxtonvogel.com/sammyos-terms.html) and [Privacy Policy](https://braxtonvogel.com/sammyos-privacy.html).

---

*Built by Braxton Vogel — [braxtonvogel.com](https://portfolio-website-w-ai.vercel.app/)*
