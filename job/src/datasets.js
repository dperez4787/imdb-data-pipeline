// Single source of truth for the pipeline: one entry per IMDb dataset file.
// `fields` is a mongoimport --fields spec (used with --columnsHaveTypes), so its
// order and names must match the file's header exactly.
// Ordered smallest-ish to largest; principals last so every other collection is
// already promoted if the big one fails.
export const BASE_URL = 'https://datasets.imdbws.com/'

export const DATASETS = [
  {
    file: 'title.ratings.tsv.gz',
    collection: 'title_ratings',
    fields: 'tconst.string(),averageRating.double(),numVotes.int64()',
    indexes: [{ key: { tconst: 1 }, unique: true }],
  },
  {
    file: 'title.episode.tsv.gz',
    collection: 'title_episode',
    fields: 'tconst.string(),parentTconst.string(),seasonNumber.int32(),episodeNumber.int32()',
    indexes: [{ key: { tconst: 1 }, unique: true }, { key: { parentTconst: 1 } }],
  },
  {
    file: 'title.crew.tsv.gz',
    collection: 'title_crew',
    fields: 'tconst.string(),directors.string(),writers.string()',
    indexes: [{ key: { tconst: 1 }, unique: true }],
  },
  {
    file: 'title.basics.tsv.gz',
    collection: 'title_basics',
    fields: 'tconst.string(),titleType.string(),primaryTitle.string(),originalTitle.string(),isAdult.int32(),startYear.int32(),endYear.int32(),runtimeMinutes.int32(),genres.string()',
    indexes: [{ key: { tconst: 1 }, unique: true }],
  },
  {
    file: 'name.basics.tsv.gz',
    collection: 'name_basics',
    fields: 'nconst.string(),primaryName.string(),birthYear.int32(),deathYear.int32(),primaryProfession.string(),knownForTitles.string()',
    indexes: [{ key: { nconst: 1 }, unique: true }],
  },
  {
    file: 'title.akas.tsv.gz',
    collection: 'title_akas',
    fields: 'titleId.string(),ordering.int32(),title.string(),region.string(),language.string(),types.string(),attributes.string(),isOriginalTitle.int32()',
    indexes: [{ key: { titleId: 1, ordering: 1 }, unique: true }],
  },
  {
    file: 'title.principals.tsv.gz',
    collection: 'title_principals',
    fields: 'tconst.string(),ordering.int32(),nconst.string(),category.string(),job.string(),characters.string()',
    indexes: [{ key: { tconst: 1, ordering: 1 }, unique: true }, { key: { nconst: 1 } }],
  },
]
