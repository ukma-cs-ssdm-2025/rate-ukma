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
}

variable "admin_user" {
  description = "Login user created by cloud-init. Root SSH login is disabled."
  type        = string
  default     = "deploy"
}

variable "ssh_public_key" {
  description = "Public key for admin_user. Its private half is the PARSER_SSH_KEY secret used by CI."
  type        = string
}

variable "labels" {
  description = "Extra Hetzner labels for all resources."
  type        = map(string)
  default     = {}
}
