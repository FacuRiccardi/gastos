output "topic" {
  value = google_pubsub_topic.gmail.id
}

output "secret_id" {
  value = google_secret_manager_secret.gmail_oauth.secret_id
}

output "process_notification_url" {
  value = try(google_cloudfunctions2_function.process[0].service_config[0].uri, null)
}

output "renew_watch_job" {
  value = try(google_cloud_scheduler_job.renew[0].name, null)
}
