// Chains the search-collection rebuild on the imdb-federation orchestrator
// after a successful import: the orchestrator's derived search_titles /
// search_names go stale the moment collections are re-promoted here.
//
// Best-effort BY DESIGN: a rebuild failure must not fail (and therefore
// re-run) the multi-hour import job. On failure we log loudly and return —
// the rebuild is independently re-runnable via imdb-federation's
// scripts/rebuild.sh. Auth is a Google-signed ID token minted by the metadata
// server as the job's runtime SA (needs roles/run.invoker on the orchestrator,
// granted in infra/search_rebuild.tf).
export const REBUILD_STEPS = [
  'titles', 'ratings', 'names', 'kft', 'popularity', 'indexes', 'promote', 'facets',
]

// Matches imdb-federation's rebuild.sh: each step must fit the orchestrator's
// Cloud Run request timeout (3600s).
const STEP_TIMEOUT_MS = 3_500_000

async function idToken(audience, fetchImpl) {
  const url =
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity' +
    `?audience=${encodeURIComponent(audience)}`
  const res = await fetchImpl(url, { headers: { 'Metadata-Flavor': 'Google' } })
  if (!res.ok) throw new Error(`metadata server token mint failed: HTTP ${res.status}`)
  return res.text()
}

export async function rebuildSearch({
  baseUrl = process.env.SEARCH_REBUILD_URL,
  fetchImpl = fetch,
  log = console,
} = {}) {
  if (!baseUrl) {
    log.log('[rebuild] SEARCH_REBUILD_URL not set — skipping search rebuild')
    return true
  }
  // one session across all steps: the orchestrator's run-session lock keeps a
  // concurrent driver from interleaving between our step requests
  const runId = `import-${Date.now()}`
  log.log(`[rebuild] rebuilding search collections at ${baseUrl} (runId ${runId})`)
  for (const step of REBUILD_STEPS) {
    const started = Date.now()
    try {
      // fresh token per step: earlier steps can outlive a token's 1h lifetime
      const token = await idToken(baseUrl, fetchImpl)
      const res = await fetchImpl(`${baseUrl}/admin/rebuild?steps=${step}&runId=${runId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
      }
      log.log(`[rebuild] ${step} done, ${Math.round((Date.now() - started) / 1000)}s`)
    } catch (err) {
      log.error(
        `[rebuild] ${step} FAILED: ${err.message} — search collections are STALE; ` +
        're-run imdb-federation/scripts/rebuild.sh',
      )
      return false
    }
  }
  log.log('[rebuild] search rebuild complete')
  return true
}
