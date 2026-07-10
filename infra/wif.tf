# The pool "github-pool" already exists and is OWNED BY linear-example's
# Terraform state. This config deliberately does NOT declare the pool — only a
# second provider on it, scoped to this repo. Never modify "github-pool" or
# its "github-provider" from here.
resource "google_iam_workload_identity_pool_provider" "github_imdb" {
  workload_identity_pool_id          = "github-pool" # referenced by ID, not resource
  workload_identity_pool_provider_id = "github-provider-imdb"
  display_name                       = "GitHub Actions (imdb-data-pipeline)"

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
  }

  attribute_condition = "assertion.repository == '${local.github_repository}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}
