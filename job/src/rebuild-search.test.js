import assert from 'node:assert/strict'
import { test } from 'node:test'
import { REBUILD_STEPS, rebuildSearch } from './rebuild-search.js'

const silent = { log: () => {}, error: () => {} }

function fakeFetch({ failOnStep } = {}) {
  const calls = []
  const impl = async (url, opts = {}) => {
    calls.push({ url, opts })
    if (url.startsWith('http://metadata.google.internal/')) {
      assert.equal(opts.headers['Metadata-Flavor'], 'Google')
      return { ok: true, status: 200, text: async () => 'fake-token' }
    }
    const step = new URL(url).searchParams.get('steps')
    if (step === failOnStep) {
      return { ok: false, status: 500, text: async () => 'boom' }
    }
    return { ok: true, status: 200, text: async () => `{"${step}":1,"status":"OK"}` }
  }
  return { impl, calls }
}

test('skips (successfully) when SEARCH_REBUILD_URL is not set', async () => {
  const { impl, calls } = fakeFetch()
  const ok = await rebuildSearch({ baseUrl: '', fetchImpl: impl, log: silent })
  assert.equal(ok, true)
  assert.equal(calls.length, 0)
})

test('runs every step in order with a shared runId and bearer token', async () => {
  const { impl, calls } = fakeFetch()
  const ok = await rebuildSearch({
    baseUrl: 'https://orch.example.com', fetchImpl: impl, log: silent,
  })
  assert.equal(ok, true)

  const stepCalls = calls.filter((c) => !c.url.startsWith('http://metadata.google.internal/'))
  assert.deepEqual(
    stepCalls.map((c) => new URL(c.url).searchParams.get('steps')),
    REBUILD_STEPS,
  )
  const runIds = new Set(stepCalls.map((c) => new URL(c.url).searchParams.get('runId')))
  assert.equal(runIds.size, 1, 'all steps must share one run session')
  for (const c of stepCalls) {
    assert.equal(c.opts.method, 'POST')
    assert.equal(c.opts.headers.Authorization, 'Bearer fake-token')
  }
  // one token mint per step (tokens can expire across long steps)
  assert.equal(calls.length, stepCalls.length * 2)
})

test('stops at the first failing step and reports failure without throwing', async () => {
  const { impl, calls } = fakeFetch({ failOnStep: 'kft' })
  const ok = await rebuildSearch({
    baseUrl: 'https://orch.example.com', fetchImpl: impl, log: silent,
  })
  assert.equal(ok, false)
  const attempted = calls
    .filter((c) => !c.url.startsWith('http://metadata.google.internal/'))
    .map((c) => new URL(c.url).searchParams.get('steps'))
  assert.deepEqual(attempted, ['titles', 'ratings', 'names', 'kft'])
})
