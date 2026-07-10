# Most of these are already enabled by linear-example's Terraform; declaring
# them here too is safe (enabling an enabled API is a no-op) and keeps this
# stack self-sufficient. Never disable on destroy — other stacks depend on them.
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "iamcredentials.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudscheduler.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}
