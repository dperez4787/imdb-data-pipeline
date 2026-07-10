resource "google_artifact_registry_repository" "job" {
  repository_id = "imdb-data-pipeline"
  location      = local.region
  format        = "DOCKER"
  description   = "imdb-import job images (tagged by commit SHA)"

  # Keep the registry from growing unboundedly — one image per weekly deploy
  # adds up. Keep the 10 most recent, delete the rest.
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }
  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"
    condition {
      older_than = "2592000s" # 30 days
    }
  }
}
