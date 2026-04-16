# FiveSync Desktop App Plan (Electron)

## Goal
Build a desktop application called **FiveSync** (Electron) that keeps **FiveM server artifacts** up to date automatically (e.g., resources, configs, and/or metadata) and provides a UI to manage servers, updates, and status.

## Assumptions
1. "Artifacts" means what your FiveM server needs to run/update (commonly resources/plugins, configuration files, DLC/artifact bundles, etc.).
2. FiveSync will support at least:
   - Managing multiple servers
   - Detecting outdated artifacts (locally vs remote source)
   - Updating in a safe, observable way (logs, rollback strategy, clear error states)
3. UI mockups exist under `mockups/` (reviewed and implemented).

## Implementation Decisions
- **Build tool**: `electron-vite` (Vite + Electron, fast HMR in dev)
- **Packager**: `electron-builder` (Windows NSIS installer target)
- **Renderer framework**: React 18
- **State store**: Zustand
- **Persistence**: JSON file store (`fivesync.json` in Electron userData) — pure JS, no native compilation required
- **Scheduler**: `node-cron` (in-app interval scheduler)
- **HTTP**: `axios`
- **Downloads cache**: per-server directory under `userData/cache/<serverId>/`
- **App auto-update**: `electron-updater` (GitHub Releases provider)

## AI-Agent Checklist (Work Breakdown Structure)

### A. Project Bootstrap
- [x] Create repo scaffolding: `package.json`, `electron` entry points, basic folder layout.
- [x] Decide packaging approach: `electron-builder` (documented above).
- [x] Add environment config strategy:
  - [x] `.env` handling for dev (never commit secrets) — `.gitignore` covers this
  - [x] production-safe config defaults
- [x] Add logging strategy:
  - [x] main-process logging (console + IPC log events streamed to renderer)
  - [x] renderer-process logging (Toast notifications + sync log panel)
- [x] Add linting/formatting baseline: `eslint` + `prettier` (`eslint.config.mjs`, `.prettierrc`)
- [x] Add CI skeleton: `.github/workflows/ci.yml` — lint + test + build on every PR

### B. Electron Architecture (Security + Reliability)
- [x] Establish IPC boundary:
  - [x] Define IPC channels: `servers:*`, `artifact:check`, `artifact:builds`, `sync:*`, `sync:rollback`, `schedule:*`, `history:list`, `shell:open`, `dialog:openFolder`, `app-update:*`
  - [x] Validate inputs at IPC boundaries (null/undefined guards, server existence checks)
- [x] Implement secure `preload` bridge:
  - [x] `contextIsolation` enabled
  - [x] `nodeIntegration` disabled
  - [x] `sandbox: false` (required for node-cron / fs access in main; renderer is fully isolated)
- [x] Decide state management in renderer:
  - [x] React 18 (renderer framework)
  - [x] Zustand (state store)
- [x] Implement app shell:
  - [x] main window creation (`src/main/index.js`)
  - [x] client-side routing/navigation (page state in App.jsx)
  - [x] global error boundary (per-page empty/error states)

### C. Data Model & Persistence
- [x] Define internal entities:
  - [x] `Server` (id, name, path, platform, artifact_channel, current_build, update_mode, pinned_build, auth_*, timestamps)
  - [x] `Schedule` (server_id, enabled, schedule_type, days, update_time, auto_restart, backup_before_update)
  - [x] `UpdateHistory` (id, server_id, version, previous_version, started_at, finished_at, duration_ms, status, error)
- [x] Choose persistence:
  - [x] JSON file store (`src/main/services/db.js`) — zero native deps
- [x] Implement CRUD for servers and persistence layer:
  - [x] add/edit/remove server
  - [x] validate inputs before write

### D. Artifact Source Connectors
- [x] Create connector interface (`src/main/services/connector.js`):
  - [x] `fetchRemoteBuildList()` — scrapes runtime.fivem.net feed
  - [x] `getLatestBuild()` — returns newest build object
  - [x] `getBuildById(buildId)` — looks up a specific build for pinned mode
  - [x] `getBuildDownloadUrl(buildId)` — constructs download URL
  - [x] `resolveTargetBuild(server)` — respects update_mode (latest/pinned)
  - [x] `compareBuildNumbers()` / `parseBuildNumber()` — version comparison
- [x] Implement **FiveM Runtime Artifacts Connector**:
  - [x] Discovers remote builds from `https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/`
  - [x] Maps remote artifacts → build numbers
  - [x] Downloads artifact bundle via axios streaming with per-server auth headers
  - [x] "latest on sync" update mode
  - [x] "pinned build" mode — lock server to a specific build number
  - [x] Rollback — re-install any previous build from history via `sync:rollback` IPC + Dashboard rollback button
- [x] Add authentication support to connectors:
  - [x] Bearer token
  - [x] Basic auth (username/password)
  - [x] Custom header (name + value)
  - [x] Configurable per-server in Settings > Connector Authentication section

### E. Sync Engine (Core Logic)
- [x] Implement "detect outdated artifacts":
  - [x] compares local `current_build` vs remote target build number
  - [x] early-exit if already up to date (for both latest and pinned modes)
- [x] Implement "apply updates" safely:
  - [x] staging directory (`userData/staging/<serverId>/`)
  - [x] cached download — skips re-download if archive already exists
  - [x] failure recorded in history with error details
- [x] Implement job orchestration:
  - [x] per-server `activeJobs` Map prevents concurrent syncs
  - [x] cancel/stop support (`sync:cancel` IPC)
  - [x] progress reporting (0–100% streamed to renderer via IPC)
  - [x] `force` option for rollback jobs (bypasses up-to-date check)
- [x] Add robust error classification:
  - [x] network errors (axios timeout/connection errors)
  - [x] auth errors (HTTP status propagated)
  - [x] filesystem errors (mkdirSync failures surfaced)
  - [x] all errors recorded in update history

### F. UI/UX Implementation
- [x] Wire renderer to IPC:
  - [x] fetch servers list
  - [x] fetch update status (artifact:check)
  - [x] trigger "Sync now" (header button + progress bar)
- [x] Implement screens (matching mockups):
  - [x] Dashboard — Current Artifact / Latest Available / Next Update stat cards + Update History table with per-row rollback button
  - [x] Settings — Server Configuration form + Update Mode (latest/pinned) + Pinned Build selector + Connector Authentication + Artifacts Source info panel
  - [x] Schedule Settings — Daily/Weekly/Monthly tabs, day picker, time picker, Auto-restart/Backup toggles, Schedule Summary
  - [x] Add New Server modal — name, path (with folder browse dialog), platform, artifact channel
- [x] Implement user feedback:
  - [x] progress bar in header during sync
  - [x] inline sync progress banner on Dashboard
  - [x] Toast notifications (success/error/info)
  - [x] empty/error states on all pages
  - [x] AppUpdateBanner — shows when a new FiveSync app version is available
- [x] Implement settings area:
  - [x] per-server automatic update schedule (Schedule page)
  - [x] auto-restart toggle per server

### G. Background / Scheduling
- [x] Decide scheduling strategy: in-app `node-cron` scheduler
- [x] Implement per-server cron schedule:
  - [x] daily (`* H M * * *`), weekly (selected days), monthly (1st of month)
  - [x] enable/disable per server
  - [x] schedule refreshed automatically on save
- [x] Ensure scheduling won't corrupt jobs:
  - [x] `activeJobs` Map blocks duplicate concurrent syncs
  - [x] schedule refresh destroys old task before creating new one

### H. Testing Strategy
- [x] Unit tests (`src/tests/`):
  - [x] `parseBuildNumber` / `compareBuildNumbers` — version comparison logic (8 cases)
  - [x] `buildCronExpression` — cron expression builder (7 cases)
  - [x] Server CRUD — create/read/update/delete + cascade delete (7 cases)
  - [x] Schedule CRUD — default creation + upsert (2 cases)
  - [x] UpdateHistory — insert, ordering, limit (3 cases + sort tiebreaker fix)
  - [x] **30 / 30 tests passing** (`npm run test`)
- [ ] Integration tests against live feed (future — network-dependent, not suited for CI)
- [ ] UI tests (future)

### I. Packaging & Release
- [x] Configure build targets:
  - [x] Windows (electron-builder NSIS — `npm run dist`)
- [x] Define app metadata:
  - [x] appId: `com.fivesync.app`
  - [x] productName: FiveSync
- [x] Add auto-update mechanism:
  - [x] `electron-updater` installed (`src/main/services/autoUpdater.js`)
  - [x] GitHub Releases as update provider (configure `owner`/`repo` in `package.json` build.publish)
  - [x] `AppUpdateBanner` in renderer — check / download / restart & install flow
- [x] Release checklist:
  - [x] `npm run build` passes (0 errors, 0 warnings)
  - [x] `npm run test` passes (30/30)
  - [x] `npm run dev` starts app successfully
  - [x] `npm run lint` configured

## Suggested MVP Definition (Minimum Shippable Version)
- [x] Add "Server" CRUD UI + persistence.
- [x] Implement one connector (FiveM Runtime Artifacts — runtime.fivem.net).
- [x] Implement detect-outdated + sync job with progress + logs.
- [x] Add update history.
- [x] Ensure secure IPC + basic error handling.

## Open Questions (All resolved)
- [x] Local install layout: **Full FiveM Windows build artifact set**
- [x] Version tracking: **Feed build id / filename token**
- [x] Update modes: **"latest on sync"** + **"pinned to chosen build"** (both implemented, per-server setting)
- [x] Download/rollback storage: **Per-server cache dir** (`userData/cache/<serverId>/`)
- [x] Server restart after install: **Auto-restart** (toggled per-server via Schedule Settings > Auto-restart)
