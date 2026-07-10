locals {
  project_id        = "project-d60a83c1-2c60-4d51-ad0"
  project_number    = "756865700041"
  region            = "us-central1"
  github_repository = "dperez4787/imdb-data-pipeline"
}

provider "google" {
  project = local.project_id
  region  = local.region
}
