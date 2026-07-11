# Architecture

## Decisions

| Question | Decision | Why |
|---|---|---|
| Compute | Cloud Run Job (not Cloud Functions) | Runs to completion (hours), container can carry the `mongoimport` CLI, first-class Cloud Scheduler integration. |
| Orchestrator language | Node 24 ESM spawning `mongoimport` | House style (linear-example); the `\N` cleanup is a pure, unit-testable Transform stream; the `mongodb` driver does rename/indexes so neither mongosh nor curl ships in the image. |
| `\N` nulls | Blanked in-stream + `mongoimport --ignoreBlanks` | Null fields are simply absent — idiomatic Mongo; no literal `"\N"` strings, no post-processing pass over 94M docs. |
| Types | `--columnsHaveTypes` with explicit `--fields` per file, `--parseGrace=skipField` | IMDb's schema is stable; numeric `averageRating`, `startYear`, `ordering` etc. make the data queryable/indexable. A stray unparseable value drops that field, not the run. |
| Atomicity | Import into `<name>_staging` (`--drop`), build indexes there, `renameCollection` with `dropTarget: true` | Readers never see empty/partial/unindexed collections. `--drop` on staging makes retries idempotent. Same-database rename is supported on dedicated tiers. |
| Job shape | One task, sequential over the 7 files | The M10 is the write bottleneck, not the container; parallel imports would contend. Per-file promote-on-success means a retry only redoes what didn't finish (acceptable weekly). Biggest file (principals) last. |
| Sizing | 2 vCPU / 2 GiB, 8h timeout, max-retries 1, `--numInsertionWorkers 4` | Streaming keeps memory flat; ~194M rows at realistic M10 throughput (5–15k docs/s) ≈ 4–8h including index builds; 24h is the platform cap. |
| Scheduler auth | OAuth token (not OIDC) | Targets on `*.googleapis.com` (the jobs `:run` endpoint) require OAuth. Scheduler SA gets `roles/run.invoker` on the job only. |
| WIF | New provider `github-provider-imdb` on the existing `github-pool` | Never touches linear-example's Terraform state or widens its repo condition. The provider only needs the pool ID string. |
| Secret | New `IMDB_MONGODB_URI`, dedicated Atlas user `readWrite@imdb` | Independent rotation; least privilege on the shared cluster. |
| Image ownership | Terraform declares the job with a placeholder image and `ignore_changes` on it; CI updates the image | Solves the bootstrap chicken-and-egg; infra config in TF, image releases in CI, no drift. |

## Dataset / collection / index matrix

| Collection | Fields (typed) | Indexes |
|---|---|---|
| `title_ratings` | tconst, averageRating (double), numVotes (int64) | `{tconst:1}` unique |
| `name_basics` | nconst, primaryName, birthYear (int32), deathYear (int32), primaryProfession, knownForTitles | `{nconst:1}` unique |
| `title_basics` | tconst, titleType, primaryTitle, originalTitle, isAdult (int32), startYear (int32), endYear (int32), runtimeMinutes (int32), genres | `{tconst:1}` unique |
| `title_crew` | tconst, directors, writers | `{tconst:1}` unique |
| `title_episode` | tconst, parentTconst, seasonNumber (int32), episodeNumber (int32) | `{tconst:1}` unique, `{parentTconst:1}` |
| `title_akas` | titleId, ordering (int32), title, region, language, types, attributes, isOriginalTitle (int32) | `{titleId:1, ordering:1}` unique |
| `title_principals` | tconst, ordering (int32), nconst, category, job, characters | `{tconst:1, ordering:1}` unique, `{nconst:1}` |

Multi-valued comma/array-ish columns (`genres`, `knownForTitles`, `directors`, `writers`,
`primaryProfession`, `characters`) are imported as raw strings — full fidelity, no reshaping.
Consumers can split on `,` as needed.

## Sizing notes

Actuals from the first full import (2026-07-10, M20 with 36 GB disk):

- **211M documents** total; 33.8 GB logical data → **10.1 GB compressed storage + 12.2 GB
  indexes** on disk. A run additionally holds a temporary staging copy of whichever
  collection is importing — for `title_principals` (100M docs, the largest) that peak
  matters, so keep storage auto-scaling on.
- Full run took **~1h50m** on an M20 with no other load. On the original M10 throughput was
  ~6x slower and the run was projected at 5–7h.
- **Do not overlap imports with Atlas topology changes** (tier/disk/version). A rolling
  resize interrupts index builds ("operation was interrupted") and the import's write load
  stalls the resize — they starve each other. Pause the Cloud Scheduler job first if a
  maintenance window must overlap Sunday 06:00 UTC.
- The Atlas cluster and the Cloud Run Job are both in GCP us-central1 — import traffic is
  intra-region.
- Failure mode: any file's final failure exits 1; Cloud Run retries the task once; staging +
  `--drop` makes the rerun idempotent and live collections are never touched by a failed
  import.
