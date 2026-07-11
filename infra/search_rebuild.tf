# After a successful import, the job POSTs the search-collection rebuild steps
# to the imdb-federation orchestrator (see job/src/rebuild-search.js). The
# orchestrator Cloud Run service is owned by the imdb-federation stack; this
# additive cross-stack grant mirrors how that stack grants itself read access
# to this stack's IMDB_MONGODB_URI secret.
resource "google_cloud_run_v2_service_iam_member" "pipeline_rebuilds_search" {
  project  = local.project_id
  location = local.region
  name     = "imdb-subgraph-orchestrator"
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.runtime.email}"
}
