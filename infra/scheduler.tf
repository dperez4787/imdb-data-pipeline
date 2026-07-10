resource "google_cloud_scheduler_job" "weekly_import" {
  name      = "imdb-import-weekly"
  region    = local.region
  schedule  = "0 6 * * 0" # Sundays 06:00 UTC, after IMDb's daily refresh
  time_zone = "Etc/UTC"

  # Deadline for the :run API call itself, not the job execution (which runs
  # for hours independently of the scheduler).
  attempt_deadline = "180s"

  http_target {
    http_method = "POST"
    uri         = "https://run.googleapis.com/v2/projects/${local.project_id}/locations/${local.region}/jobs/${google_cloud_run_v2_job.imdb_import.name}:run"

    # OAuth (not OIDC): googleapis.com targets require an OAuth access token.
    oauth_token {
      service_account_email = google_service_account.scheduler.email
    }
  }

  depends_on = [google_project_service.apis]
}
