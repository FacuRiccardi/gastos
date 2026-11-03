variable "project_id" {
  type        = string
  description = "Google Cloud project ID (personal account, no organization)."
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "Region for the Functions, Scheduler and the source bucket. us-central1 guarantees the free tier."
}

variable "firestore_location" {
  type        = string
  default     = "us-central1"
  description = "Firestore location. It CANNOT be changed after creation."
}

variable "deploy_functions" {
  type        = bool
  default     = false
  description = "false on the first pass (the gmail-oauth secret has no version yet); true on the second."
}

variable "gmail_user" {
  type        = string
  description = "The Gmail address whose mailbox is read (the notifications are filtered by this address)."
}

variable "gmail_label_id" {
  type        = string
  default     = ""
  description = "Internal Gmail label ID (like Label_123), obtained with labels.list. Required when deploy_functions = true."
}

variable "gmail_label_name" {
  type    = string
  default = "Gastos BBVA"
}

variable "alert_email" {
  type        = string
  description = "Email that receives failure and budget alerts."
}

variable "billing_account_id" {
  type        = string
  description = "Billing account ID (format XXXXXX-XXXXXX-XXXXXX)."
}

variable "monthly_budget_usd" {
  type    = number
  default = 1
}
