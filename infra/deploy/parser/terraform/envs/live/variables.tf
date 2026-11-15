variable "ssh_public_key" {
  description = "Admin SSH public key. CI sets it from the PARSER_SSH_PUBLIC_KEY environment secret."
  type        = string
}

variable "tunnel_ssh_public_key" {
  description = "Tunnel-only SSH public key. CI sets it from the PARSER_TUNNEL_SSH_PUBLIC_KEY environment secret."
  type        = string
}
