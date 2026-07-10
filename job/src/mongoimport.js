import { spawn } from 'node:child_process'
import { pipeline } from 'node:stream/promises'

export function buildArgs({ uri, db, collection, fields }) {
  return [
    '--uri', uri,
    '--db', db,
    '--collection', collection,
    '--type', 'tsv',
    '--fields', fields,
    '--columnsHaveTypes',
    '--ignoreBlanks',
    '--parseGrace=skipField',
    '--numInsertionWorkers', '4',
    '--drop',
  ]
}

// Spawns mongoimport reading the cleaned TSV from stdin. mongoimport's own
// progress/summary output goes to stderr and is inherited, so the
// "imported N documents" line lands in Cloud Logging.
export async function runMongoimport(opts, inputStream) {
  const child = spawn('mongoimport', buildArgs(opts), {
    stdio: ['pipe', 'inherit', 'inherit'],
  })

  const exited = new Promise((resolve, reject) => {
    child.on('error', reject) // e.g. binary not found
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`mongoimport exited with code ${code}`))
    })
  })

  // If the input stream dies mid-transfer, mongoimport just sees EOF and exits
  // 0 having imported a truncated file — so an input error must fail the run
  // even when the exit code is 0.
  let inputError = null
  try {
    await pipeline(inputStream, child.stdin)
  } catch (err) {
    inputError = err
    child.kill('SIGKILL')
  }

  try {
    await exited
  } catch (err) {
    throw inputError ?? err
  }
  if (inputError) throw inputError
}
