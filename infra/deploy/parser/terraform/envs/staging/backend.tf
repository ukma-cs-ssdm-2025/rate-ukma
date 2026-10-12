# State lives in Hetzner Object Storage through Terraform's generic S3 backend.
# That backend uses the AWS SDK, so it reads the Hetzner S3 keys from the
# standard AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY variables (CI fills them
# from TF_STATE_ACCESS_KEY / TF_STATE_SECRET_KEY)
terraform {
  backend "s3" {
    bucket = "rate-ukma-parser-tfstate"
    key    = "staging/terraform.tfstate"
    region = "hel1"

    endpoints = {
      s3 = "https://hel1.your-objectstorage.com"
    }

    use_lockfile = true

    # Not AWS: skip the AWS-only account, region and checksum checks.
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }
}
