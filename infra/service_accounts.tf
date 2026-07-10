# --- Deploy identity (used by GitHub Actions via WIF) ---------------------
resource "google_service_account" "deploy" {
  account_id   = "imdb-deploy"
  display_name = "imdb-data-pipeline deploy (GitHub Actions)"
}

# Additive member grants only (_member, never _binding) — this project must
# not clobber IAM managed by other stacks in the shared GCP project.
resource "google_project_iam_member" "deploy_ar_writer" {
  project = local.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_project_iam_member" "deploy_run_admin" {
  project = local.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# actAs on the runtime SA only (resource-scoped, tighter than a project grant)
resource "google_service_account_iam_member" "deploy_actas_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

# Let this repo's GitHub Actions impersonate the deploy SA
resource "google_service_account_iam_member" "deploy_wif" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${local.project_number}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${local.github_repository}"
}

# --- Runtime identity (the Cloud Run Job) ----------------------------------
resource "google_service_account" "runtime" {
  account_id   = "imdb-pipeline-run"
  display_name = "imdb-import Cloud Run Job runtime"
}
# Its only grant is secretAccessor on IMDB_MONGODB_URI — see secret.tf.

# --- Scheduler identity -----------------------------------------------------
resource "google_service_account" "scheduler" {
  account_id   = "imdb-scheduler"
  display_name = "Cloud Scheduler trigger for imdb-import"
}
# Its only grant is run.invoker on the job — see cloud_run_job.tf.
