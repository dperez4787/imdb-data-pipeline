# Infrastructure

Terraform for the `imdb-data-pipeline` stack. It lives in the **same GCP project** as
linear-example and shares its WIF pool and state bucket, but owns all of its own resources.

## Exact identifiers

| Thing                | Value |
|----------------------|-------|
| GCP project          | `project-d60a83c1-2c60-4d51-ad0` (number `756865700041`) |
| Region               | `us-central1` |
| Cloud Run Job        | `imdb-import` |
| Scheduler job        | `imdb-import-weekly` (cron `0 6 * * 0` UTC) |
| Artifact Registry    | `us-central1-docker.pkg.dev/project-d60a83c1-2c60-4d51-ad0/imdb-data-pipeline` |
| Deploy SA            | `imdb-deploy@project-d60a83c1-2c60-4d51-ad0.iam.gserviceaccount.com` |
| Runtime SA           | `imdb-pipeline-run@project-d60a83c1-2c60-4d51-ad0.iam.gserviceaccount.com` |
| Scheduler SA         | `imdb-scheduler@project-d60a83c1-2c60-4d51-ad0.iam.gserviceaccount.com` |
| Secret               | `IMDB_MONGODB_URI` (Secret Manager; version added by hand) |
| WIF provider         | `projects/756865700041/locations/global/workloadIdentityPools/github-pool/providers/github-provider-imdb` |
| Terraform state      | bucket `project-d60a83c1-2c60-4d51-ad0-tfstate`, prefix `imdb-data-pipeline` |
| Atlas cluster        | `cluster0.mvdikgq.mongodb.net` (M20, GCP us-central1), database `imdb` |

## ⚠️ Shared-infrastructure boundary

- The WIF **pool** `github-pool` and the provider `github-provider` belong to
  **linear-example's Terraform state**. This stack only adds a second provider
  (`github-provider-imdb`) on that pool. If a `terraform plan` here ever shows changes to the
  pool or to `github-provider`, **stop** — something is wrong.
- IAM grants use additive `*_iam_member` resources only, never `*_iam_binding`/`_policy`.

## One-time bootstrap (human with project Owner)

1. **Atlas** (console, cluster0):
   - Enable storage auto-scaling, or raise storage to ≥ ~30–50 GB. The full import is
     ~194M documents plus indexes plus a temporary staging copy — the default 10 GB will
     not fit.
   - Database Access → add user `imdb-pipeline` with role `readWrite` on database `imdb`
     (also grants access to `imdb_test` if you prefer `readWriteAnyDatabase`; otherwise add
     `readWrite@imdb_test` too for local E2E runs).
   - Network Access → confirm `0.0.0.0/0` is allowed (Cloud Run egress IPs are dynamic;
     linear-example already runs with this posture).

2. **Terraform** (state bucket already exists, so no local-state migration dance):

   ```bash
   gcloud auth application-default login
   cd infra
   terraform init
   terraform plan    # review: must only ADD resources; no changes to github-pool/github-provider
   terraform apply
   ```

3. **Secret version** (value never on a command line, in state, or in git):

   ```bash
   # URI: mongodb+srv://imdb-pipeline:<pw>@cluster0.mvdikgq.mongodb.net/imdb?retryWrites=true&w=majority
   printf %s "$IMDB_MONGODB_URI" | gcloud secrets versions add IMDB_MONGODB_URI \
     --project project-d60a83c1-2c60-4d51-ad0 --data-file=-
   ```

4. **GitHub repository secrets** (Settings → Secrets and variables → Actions):

   | Secret         | Value |
   |----------------|-------|
   | `WIF_PROVIDER` | `projects/756865700041/locations/global/workloadIdentityPools/github-pool/providers/github-provider-imdb` |
   | `DEPLOY_SA`    | `imdb-deploy@project-d60a83c1-2c60-4d51-ad0.iam.gserviceaccount.com` |

5. **First deploy**: push to `main` (or re-run the Deploy workflow). This builds the real
   image and replaces the placeholder the Terraform-created job starts with.

6. **First run + verification**:

   ```bash
   gcloud run jobs execute imdb-import --region us-central1 \
     --project project-d60a83c1-2c60-4d51-ad0
   # watch progress
   gcloud run jobs executions list --job imdb-import --region us-central1
   ```

   Expect several hours. In Cloud Logging, each dataset logs mongoimport's
   `N document(s) imported successfully` line followed by `[collection] promoted, ~N docs`.
   Expected magnitudes: ratings ~1.6M, episode ~9M, basics/crew ~11.5M each, name_basics
   ~14M, akas ~52M, principals ~94M. Afterwards check in Atlas: no `*_staging` collections
   remain, indexes exist, and disk usage has headroom for the next run's staging copy.

   Scheduler chain check (doesn't wait for completion):

   ```bash
   gcloud scheduler jobs run imdb-import-weekly --location us-central1 \
     --project project-d60a83c1-2c60-4d51-ad0
   gcloud run jobs executions list --job imdb-import --region us-central1  # new execution
   ```

## Day-to-day

- `terraform fmt -check -recursive`, `terraform init -backend=false`, `terraform validate`
  run in CI on every push/PR.
- `terraform plan`/`apply` are run by a human from this directory — CI does not apply
  infrastructure.
- Rollback a bad image: `gcloud run jobs update imdb-import --image <old-SHA-image> --region us-central1`.
