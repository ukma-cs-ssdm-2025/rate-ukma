module "node" {
  source = "../../modules/k3s-node"

  name        = "parser-staging"
  location    = "hel1"
  server_type = "cx23"
  k3s_version = "v1.36.5+k3s1"

  ssh_public_key = var.ssh_public_key
  labels         = { env = "staging" }
}
