import axios from 'axios'

const FEED_BASE = 'https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache'
}

async function fetchWithRetry(url, options = {}, retries = 3, delayMs = 1500) {
  let lastErr
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await axios.get(url, {
        ...options,
        headers: { ...HEADERS, ...(options.headers || {}) }
      })
    } catch (err) {
      lastErr = err
      if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs * attempt))
    }
  }
  throw lastErr
}

export async function fetchRemoteBuildList() {
  const response = await fetchWithRetry(FEED_BASE, { timeout: 20000 })
  const html = response.data
  const builds = []

  // The feed page renders links as:
  //   href= "./28108-2f3d20c4168282a17737970708ccc1524951483a/server.7z"
  // (note: space after href=, leading ./, full 40-char git SHA, /server.7z suffix)
  const regex = /href=\s*["']\.\/(\d+)-([a-f0-9]{40})\/server\.7z["']/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    const buildNumber = parseInt(match[1], 10)
    builds.push({
      buildNumber,
      buildHash: match[2],
      buildId: `${match[1]}-${match[2]}`,
      downloadUrl: `${FEED_BASE}${match[1]}-${match[2]}/server.7z`
    })
  }

  builds.sort((a, b) => b.buildNumber - a.buildNumber)
  return builds
}

export async function getLatestBuild() {
  const builds = await fetchRemoteBuildList()
  return builds.length > 0 ? builds[0] : null
}

export async function getBuildById(buildId) {
  const builds = await fetchRemoteBuildList()
  return (
    builds.find(
      (b) => b.buildId === buildId || String(b.buildNumber) === String(buildId)
    ) || null
  )
}

export function parseBuildNumber(buildId) {
  if (!buildId) return null
  const match = String(buildId).match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

export function compareBuildNumbers(localBuild, remoteBuild) {
  const local = parseBuildNumber(localBuild)
  const remote = parseBuildNumber(remoteBuild)
  if (local === null || remote === null) return null
  return remote - local
}

export async function resolveTargetBuild(server) {
  const mode = server.update_mode || 'latest'

  if (mode === 'pinned') {
    if (!server.pinned_build)
      throw new Error('Pinned mode selected but no pinned build specified')
    const build = await getBuildById(server.pinned_build)
    if (!build)
      throw new Error(`Pinned build "${server.pinned_build}" not found on remote feed`)
    return { build, mode: 'pinned' }
  }

  const latest = await getLatestBuild()
  if (!latest) throw new Error('Could not fetch remote build list')
  return { build: latest, mode: 'latest' }
}
