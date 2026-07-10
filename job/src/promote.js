export function stagingName(collection) {
  return `${collection}_staging`
}

// Build indexes on the fully-imported staging collection, then atomically
// swap it over the live one. Readers never see a partial or unindexed
// collection; a failed import leaves the live collection untouched.
export async function promote(db, { collection, indexes }) {
  const staging = stagingName(collection)
  await db.collection(staging).createIndexes(indexes)
  await db.renameCollection(staging, collection, { dropTarget: true })
}
