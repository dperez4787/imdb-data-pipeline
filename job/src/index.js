import { MongoClient } from 'mongodb'
import { BASE_URL, DATASETS } from './datasets.js'
import { download } from './download.js'
import { runMongoimport } from './mongoimport.js'
import { promote, stagingName } from './promote.js'
import { tsvClean } from './tsv-clean.js'

const ATTEMPTS_PER_FILE = 3

function selectDatasets() {
  const filter = process.env.DATASETS?.split(',').map((s) => s.trim()).filter(Boolean)
  if (!filter?.length) return DATASETS
  const known = new Set(DATASETS.map((d) => d.collection))
  const unknown = filter.filter((name) => !known.has(name))
  if (unknown.length) {
    throw new Error(`Unknown DATASETS entries: ${unknown.join(', ')} (known: ${[...known].join(', ')})`)
  }
  return DATASETS.filter((d) => filter.includes(d.collection))
}

async function importDataset(db, uri, dbName, dataset) {
  const url = new URL(dataset.file, BASE_URL).href
  let lastError
  for (let attempt = 1; attempt <= ATTEMPTS_PER_FILE; attempt++) {
    try {
      const input = (await download(url)).pipe(tsvClean())
      // --drop on the staging collection makes every attempt start clean.
      await runMongoimport(
        { uri, db: dbName, collection: stagingName(dataset.collection), fields: dataset.fields },
        input,
      )
      await promote(db, dataset)
      return
    } catch (err) {
      lastError = err
      console.error(`[${dataset.collection}] attempt ${attempt}/${ATTEMPTS_PER_FILE} failed: ${err.message}`)
    }
  }
  throw lastError
}

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('MONGODB_URI is required')
  process.exit(1)
}
const dbName = process.env.MONGODB_DB ?? 'imdb'
const datasets = selectDatasets()

const client = new MongoClient(uri)
await client.connect()
const db = client.db(dbName)

console.log(`Importing ${datasets.length} dataset(s) into db "${dbName}"`)
const failures = []
for (const dataset of datasets) {
  const started = Date.now()
  try {
    await importDataset(db, uri, dbName, dataset)
    const count = await db.collection(dataset.collection).estimatedDocumentCount()
    console.log(`[${dataset.collection}] promoted, ~${count} docs, ${Math.round((Date.now() - started) / 1000)}s`)
  } catch (err) {
    failures.push(dataset.collection)
    console.error(`[${dataset.collection}] FAILED after ${ATTEMPTS_PER_FILE} attempts: ${err.message}`)
  }
}

await client.close()

if (failures.length) {
  console.error(`Done with failures: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('All datasets imported')
