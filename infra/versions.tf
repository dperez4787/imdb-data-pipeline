terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Shared state bucket (created by linear-example's bootstrap); this project
  # uses its own prefix.
  backend "gcs" {
    bucket = "project-d60a83c1-2c60-4d51-ad0-tfstate"
    prefix = "imdb-data-pipeline"
  }
}
