import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BASE_URL, DATASETS } from './datasets.js'

// Official headers from https://developer.imdb.com/non-commercial-datasets/
const EXPECTED_HEADERS = {
  'title.ratings.tsv.gz': ['tconst', 'averageRating', 'numVotes'],
  'title.episode.tsv.gz': ['tconst', 'parentTconst', 'seasonNumber', 'episodeNumber'],
  'title.crew.tsv.gz': ['tconst', 'directors', 'writers'],
  'title.basics.tsv.gz': ['tconst', 'titleType', 'primaryTitle', 'originalTitle', 'isAdult', 'startYear', 'endYear', 'runtimeMinutes', 'genres'],
  'name.basics.tsv.gz': ['nconst', 'primaryName', 'birthYear', 'deathYear', 'primaryProfession', 'knownForTitles'],
  'title.akas.tsv.gz': ['titleId', 'ordering', 'title', 'region', 'language', 'types', 'attributes', 'isOriginalTitle'],
  'title.principals.tsv.gz': ['tconst', 'ordering', 'nconst', 'category', 'job', 'characters'],
}

test('covers all 7 IMDb dataset files exactly once', () => {
  assert.deepEqual(
    DATASETS.map((d) => d.file).sort(),
    Object.keys(EXPECTED_HEADERS).sort(),
  )
})

test('collection names are unique and underscore-style', () => {
  const names = DATASETS.map((d) => d.collection)
  assert.equal(new Set(names).size, names.length)
  for (const name of names) assert.match(name, /^[a-z0-9_]+$/)
})

test('fields specs match the official headers, in order, all typed', () => {
  for (const d of DATASETS) {
    const parts = d.fields.split(',')
    assert.deepEqual(
      parts.map((p) => p.split('.')[0]),
      EXPECTED_HEADERS[d.file],
      `${d.file} field names/order`,
    )
    for (const part of parts) {
      assert.match(part, /^\w+\.(string|int32|int64|double)\(\)$/, `${d.file}: ${part}`)
    }
  }
})

test('every dataset has a unique index', () => {
  for (const d of DATASETS) {
    assert.ok(d.indexes.some((idx) => idx.unique), `${d.collection} needs a unique index`)
  }
})

test('base URL is the IMDb datasets host', () => {
  assert.equal(BASE_URL, 'https://datasets.imdbws.com/')
})
