import assert from 'node:assert/strict'
import { createReadStream } from 'node:fs'
import { test } from 'node:test'
import { createGunzip } from 'node:zlib'
import { DATASETS } from './datasets.js'
import { tsvClean } from './tsv-clean.js'

const FIXTURES = new URL('../test/fixtures/', import.meta.url)
const FIXTURE_ROWS = 5

async function cleanFixture(file) {
  const stream = createReadStream(new URL(file, FIXTURES))
    .pipe(createGunzip())
    .pipe(tsvClean())
  let out = ''
  for await (const chunk of stream) out += chunk
  return out
}

for (const dataset of DATASETS) {
  test(`fixture ${dataset.file}: gunzip → clean produces mongoimport-ready TSV`, async () => {
    const out = await cleanFixture(dataset.file)
    const lines = out.split('\n').filter(Boolean)
    const fieldNames = dataset.fields.split(',').map((p) => p.split('.')[0])

    assert.equal(lines.length, FIXTURE_ROWS, 'header dropped, all data rows kept')
    assert.notEqual(lines[0], fieldNames.join('\t'), 'header line is gone')
    for (const line of lines) {
      assert.equal(line.split('\t').length, fieldNames.length, 'column count preserved')
      assert.ok(!line.split('\t').includes('\\N'), 'no \\N sentinel survives')
    }
  })
}
