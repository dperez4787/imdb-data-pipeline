# imdb-data-pipeline

Weekly pipeline that imports the [IMDb non-commercial datasets](https://datasets.imdbws.com/)
into MongoDB Atlas — one collection per dataset file, in the `imdb` database on
`cluster0.mvdikgq.mongodb.net`.

```
Cloud Scheduler (Sun 06:00 UTC)
        │  POST …/jobs/imdb-import:run  (OAuth)
        ▼
Cloud Run Job "imdb-import"  (us-central1, 2 vCPU / 2 GiB, 8h timeout)
        │  for each of 7 files, sequentially:
        │    fetch https://datasets.imdbws.com/<file>
        │      → gunzip → strip header / blank \N → mongoimport (stdin)
        │      → <collection>_staging  → build indexes → rename over live
        ▼
MongoDB Atlas M10 (GCP us-central1), database "imdb"
```

| File                      | Collection         | ~Rows |
|---------------------------|--------------------|-------|
| title.ratings.tsv.gz      | `title_ratings`    | 1.6M  |
| name.basics.tsv.gz        | `name_basics`      | 14M   |
| title.basics.tsv.gz       | `title_basics`     | 11.5M |
| title.crew.tsv.gz         | `title_crew`       | 11.5M |
| title.episode.tsv.gz      | `title_episode`    | 9M    |
| title.akas.tsv.gz         | `title_akas`       | 52M   |
| title.principals.tsv.gz   | `title_principals` | 94M   |

Imports are atomic per collection: data lands in `<name>_staging`, indexes are built there,
then the collection is renamed over the live one (`dropTarget: true`) — readers never see
partial or unindexed data. The largest file (principals) runs last so the rest stays fresh
even if it fails.

## Local development

```bash
cd job
cp .env.example .env          # fill in MONGODB_URI
npm ci
npm test                                              # unit tests (no network/DB)
MONGODB_DB=imdb_test DATASETS=title_ratings npm start # small real import (~1.6M rows)
```

## Deployment

Push to `main` → GitHub Actions builds the Docker image, pushes it to Artifact Registry
tagged with the commit SHA, and updates the Cloud Run Job. Auth is OIDC via Workload
Identity Federation — no service-account keys. See [infra/README.md](infra/README.md) for the
one-time bootstrap runbook, and [docs/architecture.md](docs/architecture.md) for design
decisions.

IMDb data is provided for **non-commercial use only** — see
https://developer.imdb.com/non-commercial-datasets/.
