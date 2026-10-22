locals {
  labels = merge({ managed-by = "terraform", service = "parser" }, var.labels)
}

resource "hcloud_ssh_key" "admin" {
  name       = "${var.name}-admin"
  public_key = var.ssh_public_key
  labels     = local.labels
}

# Only SSH and HTTP(S) are public. The kube-apiserver (6443) stays closed:
# CI and admins reach it through an SSH tunnel.
resource "hcloud_firewall" "node" {
  name   = var.name
  labels = local.labels

  dynamic "rule" {
    for_each = ["22", "80", "443"]
    content {
      direction  = "in"
      protocol   = "tcp"
      port       = rule.value
      source_ips = ["0.0.0.0/0", "::/0"]
    }
  }
}

resource "hcloud_server" "node" {
  name         = var.name
  location     = var.location
  server_type  = var.server_type
  image        = var.image
  ssh_keys     = [hcloud_ssh_key.admin.id]
  firewall_ids = [hcloud_firewall.node.id]
  labels       = local.labels

  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    admin_user            = var.admin_user
    ssh_public_key        = var.ssh_public_key
    tunnel_user           = var.tunnel_user
    tunnel_ssh_public_key = var.tunnel_ssh_public_key
    k3s_version           = var.k3s_version
  })

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  # Deleting the server wipes the cluster and its data, so it must be a separate, deliberate change.
  # To rebuild on purpose: first merge a change that turns all three off.
  delete_protection  = true # Hetzner refuses to delete it, also from the console
  rebuild_protection = true # must match delete_protection

  lifecycle {
    # A plan that would replace the server (new image or location, a rename) fails instead.
    prevent_destroy = true

    # Changing either would rebuild the server and wipe the cluster.
    # They only matter on first boot; later changes are done on the node.
    ignore_changes = [user_data, ssh_keys]
  }
}
