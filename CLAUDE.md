# imdb-data-pipeline

Weekly batch pipeline: streams the 7 IMDb non-commercial datasets (https://datasets.imdbws.com/)
into MongoDB Atlas, one collection per file, database `imdb`. Runs as a Cloud Run Job triggered
by Cloud Scheduler (Sundays 06:00 UTC). Sibling project of
`/Users/danielperez/Development/linear-example` — it shares that project's GCP project, Atlas
cluster, and infra conventions.

## Stack

| Layer      | Choice                                                        |
|------------|---------------------------------------------------------------|
| Runtime    | Node.js 24, ESM (`"type": "module"`), npm                     |
| Import     | `mongoimport` (mongodb-database-tools) spawned from Node      |
| DB access  | `mongodb` driver (index builds + collection promote only)     |
| Compute    | Cloud Run Job `imdb-import`, us-central1, 2 vCPU / 2 GiB, 8h  |
| Schedule   | Cloud Scheduler `imdb-import-weekly`, cron `0 6 * * 0` UTC    |
| Infra      | Terraform (google ~> 6.0), GCS state bucket, prefix `imdb-data-pipeline` |
| CI/CD      | GitHub Actions, OIDC via Workload Identity Federation (no SA keys) |
| Tests      | Node built-in test runner (`node --test`), no ESLint          |

## Layout

- `job/` — the only container. `src/datasets.js` is the single source of truth
  (file → collection → mongoimport fields spec → indexes). `src/index.js` loops datasets
  sequentially: download → gunzip → tsv-clean → mongoimport into `<name>_staging` → indexes →
  rename over live with `dropTarget: true`.
- `infra/` — Terraform. Bootstrap runbook in `infra/README.md`.
- `.github/workflows/` — `ci.yml` (tests + terraform validate), `deploy.yml` (build/push image,
  update the job on push to main).

## Conventions

- Env vars: `MONGODB_URI` (from Secret Manager secret `IMDB_MONGODB_URI` in prod; gitignored
  `job/.env` locally), `MONGODB_DB` (default `imdb`; tests/local use `imdb_test`),
  `DATASETS` (optional comma-separated collection filter, e.g. `DATASETS=title_ratings`).
- IMDb `\N` sentinels are blanked in-stream and dropped by `--ignoreBlanks` — null fields are
  absent, never the literal string `"\N"`.
- Images are tagged by commit SHA, never `latest`. Rollback = `gcloud run jobs update` with an
  old SHA.
- Terraform owns all job config except the container image (`lifecycle ignore_changes`); CI owns
  the image. Don't set the image in Terraform.
- GCP project `project-d60a83c1-2c60-4d51-ad0` (number 756865700041), region `us-central1`.

## Deliberate divergences from linear-example

- Separate Secret Manager secret `IMDB_MONGODB_URI` and dedicated Atlas user
  (`imdb-pipeline`, `readWrite@imdb`) — independent rotation, least privilege.
- New WIF **provider** `github-provider-imdb` on the **existing shared pool** `github-pool`.
  Never modify `github-pool` or `github-provider` — they belong to linear-example's Terraform
  state.
- Own deploy SA (`imdb-deploy`), runtime SA (`imdb-pipeline-run`), scheduler SA
  (`imdb-scheduler`), and Artifact Registry repo (`imdb-data-pipeline`).
- CI runs real test/validate jobs (linear-example has none).

## Commands

```bash
cd job && npm test                                   # unit tests, no network/DB
MONGODB_DB=imdb_test DATASETS=title_ratings npm start  # small real import (needs .env)
cd infra && terraform fmt -check && terraform validate
gcloud run jobs execute imdb-import --region us-central1 --project project-d60a83c1-2c60-4d51-ad0
```
