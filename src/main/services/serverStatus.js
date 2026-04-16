import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// .fivesync-build — marker written by FiveSync after every managed update.
// This is the ONLY reliable source of the build number for a FiveSync-managed
// install. FiveM itself does not embed the build number anywhere on disk.
// ---------------------------------------------------------------------------
const MARKER = '.fivesync-build'

export function readMarkerBuild(serverPath) {
  if (!serverPath) return null
  try {
    const p = join(serverPath, MARKER)
    if (!existsSync(p)) return null
    return readFileSync(p, 'utf8').trim() || null
  } catch {
    return null
  }
}

export function writeMarkerBuild(serverPath, buildId) {
  if (!serverPath || !buildId) return
  try {
    writeFileSync(join(serverPath, MARKER), String(buildId), 'utf8')
  } catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------
// detectInstalledBuild — only reliable for FiveSync-managed installs
// (reads the .fivesync-build marker).  For pre-existing installs the user
// must enter the build number manually via Settings.
// ---------------------------------------------------------------------------
export function detectInstalledBuild(serverPath) {
  if (!serverPath || !existsSync(serverPath)) return null
  return readMarkerBuild(serverPath)
}

// ---------------------------------------------------------------------------
// isServerProcessRunning — check whether FXServer.exe is running from the
// given directory using PowerShell (Windows) or pgrep (Linux/Mac).
// ---------------------------------------------------------------------------
export function isServerProcessRunning(serverPath) {
  try {
    if (process.platform === 'win32') {
      const cmd =
        `powershell -NoProfile -NonInteractive -Command ` +
        `"Get-Process FXServer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path"`
      const out = execSync(cmd, { timeout: 6000, stdio: ['pipe', 'pipe', 'ignore'] })
        .toString()
        .toLowerCase()

      if (!out.trim()) return false

      if (serverPath) {
        // Normalise path separators for comparison
        const norm = serverPath.toLowerCase().replace(/[\\/]+/g, '\\')
        return out.replace(/[\\/]+/g, '\\').includes(norm)
      }
      return out.includes('fxserver')
    } else {
      const out = execSync(`pgrep -f "FXServer|run.sh" 2>/dev/null || true`, { timeout: 4000 })
        .toString()
        .trim()
      return out.length > 0
    }
  } catch {
    return false
  }
}
