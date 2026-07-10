import { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'

// Returns a Node stream of the decompressed TSV text. Nothing touches disk;
// the whole pipeline is fetch → gunzip → transform → mongoimport stdin.
export async function download(url) {
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`GET ${url} failed: HTTP ${res.status}`)
  }
  return Readable.fromWeb(res.body).pipe(createGunzip())
}
