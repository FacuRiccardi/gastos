terraform {
  required_version = ">= 1.5"
  required_providers {
    google  = { source = "hashicorp/google", version = "~> 6.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.4" }
  }
}

provider "google" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}

data "google_project" "this" {}

locals {
  deploy         = var.deploy_functions ? 1 : 0
  runtime_sa     = google_service_account.functions.email
  invoker_sa     = google_service_account.invoker.email
  src_files      = fileset("${path.module}/../src", "**")
  functions      = { process = "process-notification", renew = "renew-watch" }
  pubsub_service = "service-${data.google_project.this.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# ---- APIs ----
resource "google_project_service" "apis" {
  for_each = toset([
    "gmail.googleapis.com", "pubsub.googleapis.com", "run.googleapis.com",
    "cloudfunctions.googleapis.com", "cloudbuild.googleapis.com", "artifactregistry.googleapis.com",
    "cloudscheduler.googleapis.com", "firestore.googleapis.com", "secretmanager.googleapis.com",
    "monitoring.googleapis.com", "billingbudgets.googleapis.com", "iam.googleapis.com",
    "eventarc.googleapis.com", "cloudresourcemanager.googleapis.com", "compute.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# ---- Pub/Sub: Gmail publishes here ----
resource "google_pubsub_topic" "gmail" {
  name       = "gmail-notifications"
  depends_on = [google_project_service.apis]
}

resource "google_pubsub_topic_iam_member" "gmail_publisher" {
  topic  = google_pubsub_topic.gmail.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:gmail-api-push@system.gserviceaccount.com"
}

# ---- Firestore (the location cannot be changed later) ----
resource "google_firestore_database" "default" {
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"
  depends_on  = [google_project_service.apis]
}

# ---- Secret: only the container. The value is loaded by scripts/authorize.js ----
resource "google_secret_manager_secret" "gmail_oauth" {
  secret_id = "gmail-oauth"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

# ---- Service accounts and IAM ----
resource "google_service_account" "functions" {
  account_id   = "expenses-functions"
  display_name = "Runtime of the expenses Functions"
  depends_on   = [google_project_service.apis]
}

resource "google_service_account" "invoker" {
  account_id   = "expenses-invoker"
  display_name = "Invokes the Functions (Pub/Sub push and Scheduler) via OIDC"
  depends_on   = [google_project_service.apis]
}

resource "google_project_iam_member" "functions_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${local.runtime_sa}"
}

resource "google_secret_manager_secret_iam_member" "functions_secret" {
  secret_id = google_secret_manager_secret.gmail_oauth.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.runtime_sa}"
}

# Pub/Sub must be able to sign OIDC tokens as the invoker service account
resource "google_service_account_iam_member" "pubsub_token_creator" {
  service_account_id = google_service_account.invoker.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${local.pubsub_service}"
  depends_on         = [google_project_service.apis]
}

# Cloud Build for gen2 Functions uses the default Compute service account
resource "google_project_iam_member" "build_default_compute" {
  project    = var.project_id
  role       = "roles/cloudbuild.builds.builder"
  member     = "serviceAccount:${data.google_project.this.number}-compute@developer.gserviceaccount.com"
  depends_on = [google_project_service.apis]
}

# ---- Function source code ----
data "archive_file" "src" {
  type        = "zip"
  output_path = "${path.module}/build/function.zip"

  dynamic "source" {
    for_each = local.src_files
    content {
      content  = file("${path.module}/../src/${source.value}")
      filename = "src/${source.value}"
    }
  }
  source {
    content  = file("${path.module}/../package.json")
    filename = "package.json"
  }
  source {
    content  = file("${path.module}/../package-lock.json")
    filename = "package-lock.json"
  }
}

resource "google_storage_bucket" "src" {
  name                        = "${var.project_id}-expenses-src"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true
  depends_on                  = [google_project_service.apis]
}

resource "google_storage_bucket_object" "src" {
  name   = "function-${data.archive_file.src.output_md5}.zip"
  bucket = google_storage_bucket.src.name
  source = data.archive_file.src.output_path
}

# ---- Gen2 Functions, private (no allUsers; only the invoker SA can call them) ----
resource "google_cloudfunctions2_function" "process" {
  count    = local.deploy
  name     = local.functions.process
  location = var.region

  lifecycle {
    precondition {
      condition     = var.gmail_label_id != ""
      error_message = "gmail_label_id is required when deploy_functions = true."
    }
  }

  build_config {
    runtime     = "nodejs22"
    entry_point = "processNotification"
    source {
      storage_source {
        bucket = google_storage_bucket.src.name
        object = google_storage_bucket_object.src.name
      }
    }
  }

  service_config {
    service_account_email = local.runtime_sa
    available_memory      = "256M"
    timeout_seconds       = 120
    min_instance_count    = 0
    max_instance_count    = 3
    environment_variables = {
      GMAIL_USER       = var.gmail_user
      GMAIL_LABEL_ID   = var.gmail_label_id
      GMAIL_LABEL_NAME = var.gmail_label_name
      PUBSUB_TOPIC     = google_pubsub_topic.gmail.id
    }
    secret_environment_variables {
      key        = "GMAIL_OAUTH_SECRET"
      project_id = var.project_id
      secret     = google_secret_manager_secret.gmail_oauth.secret_id
      version    = "latest"
    }
  }
  depends_on = [google_project_service.apis, google_secret_manager_secret_iam_member.functions_secret]
}

resource "google_cloudfunctions2_function" "renew" {
  count    = local.deploy
  name     = local.functions.renew
  location = var.region

  build_config {
    runtime     = "nodejs22"
    entry_point = "renewWatch"
    source {
      storage_source {
        bucket = google_storage_bucket.src.name
        object = google_storage_bucket_object.src.name
      }
    }
  }

  service_config {
    service_account_email = local.runtime_sa
    available_memory      = "256M"
    timeout_seconds       = 300
    min_instance_count    = 0
    max_instance_count    = 1
    environment_variables = {
      GMAIL_USER       = var.gmail_user
      GMAIL_LABEL_ID   = var.gmail_label_id
      GMAIL_LABEL_NAME = var.gmail_label_name
      PUBSUB_TOPIC     = google_pubsub_topic.gmail.id
    }
    secret_environment_variables {
      key        = "GMAIL_OAUTH_SECRET"
      project_id = var.project_id
      secret     = google_secret_manager_secret.gmail_oauth.secret_id
      version    = "latest"
    }
  }
  depends_on = [google_project_service.apis, google_secret_manager_secret_iam_member.functions_secret]
}

resource "google_cloud_run_service_iam_member" "invoker_process" {
  count    = local.deploy
  location = var.region
  service  = google_cloudfunctions2_function.process[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${local.invoker_sa}"
}

resource "google_cloud_run_service_iam_member" "invoker_renew" {
  count    = local.deploy
  location = var.region
  service  = google_cloudfunctions2_function.renew[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${local.invoker_sa}"
}

# ---- Pub/Sub push (OIDC) to process-notification ----
resource "google_pubsub_subscription" "push" {
  count                      = local.deploy
  name                       = "gmail-notifications-push"
  topic                      = google_pubsub_topic.gmail.id
  ack_deadline_seconds       = 60
  message_retention_duration = "86400s" # retries stop after 24 h

  push_config {
    push_endpoint = google_cloudfunctions2_function.process[0].service_config[0].uri
    oidc_token {
      service_account_email = local.invoker_sa
      audience              = google_cloudfunctions2_function.process[0].service_config[0].uri
    }
  }

  # Without this Pub/Sub deletes the subscription after 31 days of inactivity (e.g. a month without purchases)
  expiration_policy {
    ttl = ""
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
  depends_on = [google_service_account_iam_member.pubsub_token_creator]
}

# ---- Daily Scheduler: renews the watch (expires after 7 days) and reconciles ----
resource "google_cloud_scheduler_job" "renew" {
  count     = local.deploy
  name      = "renew-watch-daily"
  region    = var.region
  schedule  = "0 6 * * *"
  time_zone = "America/Argentina/Buenos_Aires"

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions2_function.renew[0].service_config[0].uri
    oidc_token {
      service_account_email = local.invoker_sa
      audience              = google_cloudfunctions2_function.renew[0].service_config[0].uri
    }
  }
  depends_on = [google_project_service.apis]
}

# ---- Alerts ----
resource "google_monitoring_notification_channel" "email" {
  display_name = "Expenses - email"
  type         = "email"
  labels       = { email_address = var.alert_email }
  depends_on   = [google_project_service.apis]
}

resource "google_monitoring_alert_policy" "errors" {
  display_name = "Expenses: error in the Functions"
  combiner     = "OR"

  conditions {
    display_name = "Log with ERROR severity"
    condition_matched_log {
      filter = <<-EOT
        resource.type="cloud_run_revision"
        AND resource.labels.service_name=("${local.functions.process}" OR "${local.functions.renew}")
        AND severity>=ERROR
      EOT
    }
  }

  alert_strategy {
    notification_rate_limit {
      period = "3600s"
    }
  }
  notification_channels = [google_monitoring_notification_channel.email.id]
  depends_on            = [google_project_service.apis]
}

resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account_id
  display_name    = "Card expenses - monthly budget"

  budget_filter {
    projects = ["projects/${data.google_project.this.number}"]
  }
  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }
  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 1.0
  }

  all_updates_rule {
    monitoring_notification_channels = [google_monitoring_notification_channel.email.id]
    disable_default_iam_recipients   = false
  }
  depends_on = [google_project_service.apis]
}
