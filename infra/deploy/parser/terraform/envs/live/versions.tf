terraform {
  # 1.10+ for S3-native state locking (use_lockfile).
  required_version = ">= 1.10"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.70"
    }
  }
}
