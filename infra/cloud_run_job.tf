resource "google_cloud_run_v2_job" "imdb_import" {
  name     = "imdb-import"
  location = local.region

  template {
    task_count = 1

    template {
      service_account = google_service_account.runtime.email
      max_retries     = 1
      timeout         = "28800s" # 8h; full run is ~4-8h at M10 write throughput

      containers {
        # Placeholder only — CI owns the real image (see deploy.yml, which runs
        # `gcloud run jobs update --image`). ignore_changes below keeps
        # Terraform from reverting CI's deploys.
        image = "us-docker.pkg.dev/cloudrun/container/job"

        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }

        env {
          name = "MONGODB_URI"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.mongodb_uri.secret_id
              version = "latest"
            }
          }
        }

        env {
          name  = "MONGODB_DB"
          value = "imdb"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image]
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_job_iam_member" "scheduler_invokes" {
  name     = google_cloud_run_v2_job.imdb_import.name
  location = local.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}
