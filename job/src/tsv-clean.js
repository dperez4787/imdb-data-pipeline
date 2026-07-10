import { Transform } from 'node:stream'

// IMDb uses the literal two characters backslash-N as the null sentinel.
// mongoimport with --ignoreBlanks drops empty fields, so blanking \N here means
// null fields are simply absent from the resulting documents.
const NULL_SENTINEL = '\\N'

function cleanLine(line) {
  return line
    .split('\t')
    .map((field) => (field === NULL_SENTINEL ? '' : field))
    .join('\t')
}

// Transform stream over TSV text: drops the header line (we pass an explicit
// --fields spec to mongoimport instead) and blanks \N fields. Buffers to
// newline boundaries so \N split across chunks is handled correctly.
export function tsvClean() {
  let remainder = ''
  let headerDropped = false

  return new Transform({
    transform(chunk, _encoding, callback) {
      const lines = (remainder + chunk.toString('utf8')).split('\n')
      remainder = lines.pop()

      const out = []
      for (const line of lines) {
        if (!headerDropped) {
          headerDropped = true
          continue
        }
        out.push(cleanLine(line))
      }
      callback(null, out.length ? `${out.join('\n')}\n` : '')
    },

    flush(callback) {
      // A leftover final line without a trailing newline; if the header was
      // never dropped, this IS the header — emit nothing.
      if (remainder !== '' && headerDropped) {
        callback(null, `${cleanLine(remainder)}\n`)
      } else {
        callback()
      }
    },
  })
}
