import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tsvClean } from './tsv-clean.js'

async function run(chunks) {
  const stream = tsvClean()
  let out = ''
  stream.on('data', (chunk) => { out += chunk })
  const done = new Promise((resolve, reject) => {
    stream.on('end', resolve)
    stream.on('error', reject)
  })
  for (const chunk of chunks) stream.write(chunk)
  stream.end()
  await done
  return out
}

test('drops the header line', async () => {
  const out = await run(['tconst\taverageRating\tnumVotes\ntt0000001\t5.7\t2143\n'])
  assert.equal(out, 'tt0000001\t5.7\t2143\n')
})

test('blanks \\N fields, including consecutive ones', async () => {
  const out = await run(['a\tb\tc\td\nx\t\\N\t\\N\ty\n'])
  assert.equal(out, 'x\t\t\ty\n')
})

test('does not touch \\N appearing inside a field value', async () => {
  const out = await run(['a\tb\nfoo\\Nbar\t\\N\n'])
  assert.equal(out, 'foo\\Nbar\t\n')
})

test('handles lines and sentinels split across chunk boundaries', async () => {
  const text = 'a\tb\tc\nrow1\t\\N\tv1\nrow2\tv2\t\\N\n'
  // feed one byte at a time — worst-case chunking
  const out = await run([...text])
  assert.equal(out, 'row1\t\tv1\nrow2\tv2\t\n')
})

test('emits a final line that has no trailing newline', async () => {
  const out = await run(['a\tb\nrow1\t\\N'])
  assert.equal(out, 'row1\t\n')
})

test('header-only input (no trailing newline) emits nothing', async () => {
  const out = await run(['a\tb\tc'])
  assert.equal(out, '')
})

test('preserves row count', async () => {
  const rows = Array.from({ length: 100 }, (_, i) => `tt${i}\t\\N\t${i}`)
  const out = await run([`h1\th2\th3\n${rows.join('\n')}\n`])
  assert.equal(out.split('\n').filter(Boolean).length, 100)
})
