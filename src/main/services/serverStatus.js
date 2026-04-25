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

// isServerProcessRunning: implemented in [processControl.js](processControl.js) (configurable + legacy FXServer).
export { isServerProcessRunning } from './processControl'
