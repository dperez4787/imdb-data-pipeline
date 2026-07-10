import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildArgs } from './mongoimport.js'

test('builds the expected mongoimport argument list', () => {
  const args = buildArgs({
    uri: 'mongodb+srv://u:p@example.net/',
    db: 'imdb',
    collection: 'title_ratings_staging',
    fields: 'tconst.string(),averageRating.double(),numVotes.int64()',
  })

  const flag = (name) => args[args.indexOf(name) + 1]
  assert.equal(flag('--uri'), 'mongodb+srv://u:p@example.net/')
  assert.equal(flag('--db'), 'imdb')
  assert.equal(flag('--collection'), 'title_ratings_staging')
  assert.equal(flag('--type'), 'tsv')
  assert.equal(flag('--fields'), 'tconst.string(),averageRating.double(),numVotes.int64()')

  // header is stripped by tsv-clean, so --headerline must NOT be passed
  assert.ok(!args.includes('--headerline'))
  for (const required of ['--columnsHaveTypes', '--ignoreBlanks', '--parseGrace=skipField', '--drop']) {
    assert.ok(args.includes(required), required)
  }
})
