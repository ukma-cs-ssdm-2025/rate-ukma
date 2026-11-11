output "ipv4" {
  description = "Public IPv4, for the DNS A record and SSH."
  value       = hcloud_server.node.ipv4_address
}

output "ipv6" {
  description = "Public IPv6, for an optional AAAA record."
  value       = hcloud_server.node.ipv6_address
}
