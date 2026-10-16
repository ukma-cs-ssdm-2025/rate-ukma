variable "name" {
  description = "Server name, also used as a prefix for the SSH key and firewall."
  type        = string
}

variable "location" {
  description = "Hetzner location, e.g. hel1 or nbg1."
  type        = string
}

variable "server_type" {
  description = "Hetzner server type, e.g. cx23 (2 vCPU, 4 GB)."
  type        = string
}

variable "image" {
  description = "OS image."
  type        = string
  default     = "ubuntu-24.04"
}

variable "k3s_version" {
  description = "Pinned k3s release, e.g. v1.36.5+k3s1. Only used on first boot."
  type        = string

  validation {
    condition     = can(regex("^v[0-9]+\\.[0-9]+\\.[0-9]+\\+k3s[0-9]+$", var.k3s_version))
    error_message = "k3s_version must be a full k3s release tag, e.g. v1.36.5+k3s1."
  }
}

variable "admin_user" {
  description = "Login user created by cloud-init. Root SSH login is disabled."
  type        = string
  default     = "deploy"
}

variable "ssh_public_key" {
  description = "Public key for admin_user. Its private half is the PARSER_SSH_KEY secret used by CI."
  type        = string

  # Catches an unset PARSER_SSH_PUBLIC_KEY secret at plan time, not at apply.
  validation {
    condition     = can(regex("^ssh-ed25519 [A-Za-z0-9+/=]+", trimspace(var.ssh_public_key)))
    error_message = "ssh_public_key must be an ed25519 public key (ssh-ed25519 AAAA...). Is the PARSER_SSH_PUBLIC_KEY environment secret set?"
  }
}

variable "labels" {
  description = "Extra Hetzner labels for all resources."
  type        = map(string)
  default     = {}
}
