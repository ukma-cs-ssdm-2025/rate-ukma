output "ipv4" {
  description = "Point the staging DNS A record here."
  value       = module.node.ipv4
}

output "ipv6" {
  value = module.node.ipv6
}
