# Secret container only. The value (Atlas connection string for the dedicated
# imdb-pipeline DB user) is added by hand and never appears in Terraform state,
# git, or CI logs:
#   printf %s "$URI" | gcloud secrets versions add IMDB_MONGODB_URI --data-file=-
resource "google_secret_manager_secret" "mongodb_uri" {
  secret_id = "IMDB_MONGODB_URI"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_iam_member" "runtime_reads_uri" {
  secret_id = google_secret_manager_secret.mongodb_uri.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}
