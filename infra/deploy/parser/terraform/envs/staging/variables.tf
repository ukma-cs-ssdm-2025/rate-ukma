variable "ssh_public_key" {
  description = "Admin SSH public key. CI sets it from the PARSER_SSH_PUBLIC_KEY environment secret."
  type        = string
}
