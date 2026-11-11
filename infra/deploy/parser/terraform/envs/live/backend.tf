# Same bucket and SSE-C setup as envs/staging/backend.tf, with its own state key.
# The S3 keys come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY and the SSE-C
# key from AWS_SSE_CUSTOMER_KEY (CI fills them from the Parser Live environments).
# Every plan and apply needs the same SSE-C key: losing it makes the state unreadable
terraform {
  backend "s3" {
    bucket = "rate-ukma-parser-tfstate"
    key    = "live/terraform.tfstate"
    region = "hel1"

    endpoints = {
      s3 = "https://hel1.your-objectstorage.com"
    }

    use_lockfile = true
    encrypt      = true

    # Not AWS: skip the AWS-only account, region and checksum checks.
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }
}
