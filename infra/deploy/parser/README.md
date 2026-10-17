# UKMA Data (parser) infrastructure

Terraform and Kubernetes config for the UKMA Data service. Design and decisions: [`docs/parser-service/deployment-infrastructure.md`](../../../docs/parser-service/deployment-infrastructure.md).

```text
infra/deploy/parser/
├── terraform/
│   ├── modules/
│   │   └── k3s-node/     # Hetzner VM + firewall, k3s installed by cloud-init
│   └── envs/
│       └── staging/      # one root module (and one state file) per environment
└── k8s/
    └── platform/
        ├── operators/    # cert-manager, CloudNativePG (pinned upstream manifests)
        └── config/       # parser namespace, Let's Encrypt ClusterIssuers
```

Terraform runs from CI only, via [`.github/workflows/parser-infra.yml`](../../../.github/workflows/parser-infra.yml):

- **Pull requests** touching `terraform/` run `terraform fmt -check` and `terraform validate`. These need no credentials.
- **Actions → Provision Parser VM → Run workflow** runs `plan`, or `plan` followed by `apply`, against the chosen environment. Applies are serialized per environment.

Don't run `apply` from a laptop. The state holds secrets and must live only in the bucket.

## One-time setup (per environment)

These steps are manual because Terraform needs them before it can run.

1. **Hetzner project.** Use a dedicated Hetzner Cloud project for the parser, separate from the Rate UKMA VMs. Then neither the API token nor the S3 keys can reach the main app's servers.
2. **State bucket.** In that project, open Object Storage and create the bucket `rate-ukma-parser-tfstate` in `hel1`. All environments share the bucket and are kept apart by key (`<env>/terraform.tfstate`).
   - Keep it **private** (the default).
   - Turn on **versioning** so a broken state can be rolled back.
   - If the bucket name is taken, pick another and update `bucket` in every `envs/*/backend.tf`.
3. **Credentials.** In the same project, create:
   - an API token with read & write access (Security → API tokens);
   - an S3 credential pair (Object Storage → S3 credentials);
   - a state encryption key (SSE-C): `openssl rand -base64 32`. Store it in the team password manager too. Terraform needs this exact key for every later plan and apply, and the state can't be read without it.
4. **GitHub Environment.** Create `Parser Staging` (later `Parser Live`) under Settings → Environments.
   - Add a **required reviewer**. Every manual run, `plan` included, waits for approval, because both get the secrets below. Leave **Prevent self-review** off if you are the only reviewer.
   - Under **Deployment branches and tags**, pick **Selected branches and tags** and allow only `main`. Otherwise a run from any branch could read the secrets.
   - Add these secrets:

     | Secret | Value |
     | --- | --- |
     | `HCLOUD_TOKEN` | Hetzner API token |
     | `TF_STATE_ACCESS_KEY` | S3 access key |
     | `TF_STATE_SECRET_KEY` | S3 secret key |
     | `TF_STATE_SSE_CUSTOMER_KEY` | state encryption key (base64, 32 bytes) |

5. **Check.** Run the workflow with `action: plan`. On an empty environment it should report `No changes.`, and `staging/terraform.tfstate` should appear in the bucket after the first `apply`.

## Cluster node (`modules/k3s-node`)

Each environment is one Hetzner VM running single-node k3s:

- **Firewall:** only 22, 80 and 443 are open. The Kubernetes API (6443) is never public. Reach it through an SSH tunnel.
- **First boot:** cloud-init creates the `deploy` user, turns off root and password SSH logins, and installs the pinned k3s.
- **k3s settings:** `/etc/rancher/k3s/config.yaml` turns on Secrets encryption at rest. The bundled Traefik is the ingress controller.
- **Later changes:** Terraform ignores changes to `user_data` and SSH keys, because applying them would rebuild the server and wipe the cluster. Upgrade k3s and rotate keys on the node instead.
- **Delete protection:** the server has Hetzner delete and rebuild protection and `prevent_destroy`, so a plan that would replace it (new `image` or `location`, a renamed resource, `terraform destroy`) fails. `server_type`, `name` and `labels` change in place. To rebuild on purpose, first merge a PR that turns the protection off.
- **Upgrading k3s:** bumping `k3s_version` doesn't upgrade a running node. Upgrade on the node, one minor version at a time, then bump `k3s_version` to match so a rebuilt node gets the same version:

  ```bash
  ssh deploy@<ipv4> 'curl -fsSL -o /tmp/k3s-install.sh https://get.k3s.io && sudo INSTALL_K3S_VERSION=<new-version> sh /tmp/k3s-install.sh server'
  ```

  The installer keeps `/etc/rancher/k3s/config.yaml`, so Secrets encryption stays on. system-upgrade-controller can automate this later.

### Before the first `apply`

1. Generate a key pair for the node: `ssh-keygen -t ed25519 -N "" -C parser-staging -f parser-staging` (no passphrase, so CI can use it).
2. In the GitHub Environment, add:

   | Name | Kind | Value |
   | --- | --- | --- |
   | `PARSER_SSH_PUBLIC_KEY` | secret | contents of `parser-staging.pub` |
   | `PARSER_SSH_KEY` | secret | contents of `parser-staging` (the private key) |

   Then delete the local private key, or store it in the team password manager.

### After the first `apply`

1. **DNS:** add a Route 53 A record pointing the staging host at the `ipv4` from the run summary.
2. **Check the node:** wait ~2 minutes for cloud-init, then:

   ```bash
   ssh deploy@<ipv4> 'cloud-init status --wait && sudo k3s kubectl get nodes && sudo k3s secrets-encrypt status'
   ```

   The node should be `Ready` and encryption `Enabled`.
3. **Kubeconfig:** copy the admin kubeconfig into the `PARSER_KUBECONFIG` environment secret. Keep its `server: https://127.0.0.1:6443`, because CI reaches it through the tunnel.

   ```bash
   ssh deploy@<ipv4> sudo cat /etc/rancher/k3s/k3s.yaml
   ```

4. **Admin access from a laptop:** open a tunnel with `ssh -N -L 6443:127.0.0.1:6443 deploy@<ipv4>`, then use the kubeconfig as is.

## Platform add-ons (`k8s/platform`)

Cluster-wide add-ons, applied by [`.github/workflows/parser-platform.yml`](../../../.github/workflows/parser-platform.yml):

- **`operators/`:** upstream cert-manager and CloudNativePG manifests, pinned to exact releases.
- **`config/`:** the `parser` namespace and the `letsencrypt-staging` and `letsencrypt-prod` ClusterIssuers. It needs the operator CRDs, so it is applied second.
- **Ingress:** the Traefik bundled with k3s, IngressClass `traefik`. It is not in this folder.

The workflow reaches the API server through [`.github/actions/k8s-tunnel`](../../../.github/actions/k8s-tunnel/action.yml), an SSH tunnel to `127.0.0.1:6443` on the node.
Pull requests only render the kustomizations.
**Actions → Parser Platform → Run workflow** runs `diff` or `apply`, and waits for the environment's reviewer.

### Before the first run

Add these secrets to the GitHub Environment, next to `PARSER_SSH_KEY` and `PARSER_KUBECONFIG`:

| Secret | Value |
| --- | --- |
| `PARSER_SSH_HOST` | the node's `ipv4` |
| `PARSER_SSH_KNOWN_HOSTS` | the node's host key line, from `ssh-keyscan -t ed25519 <ipv4>` |

Check the scanned key before saving it.
Its fingerprint must match the one the node reports:

```bash
ssh-keyscan -t ed25519 <ipv4> | ssh-keygen -lf -
ssh deploy@<ipv4> ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

### Check

Run the workflow with `action: apply`.
The run summary should show the cert-manager and CNPG pods `Running` and both ClusterIssuers `True`.
A following `diff` run should print no changes.

### Upgrading an operator

Change its version in `operators/kustomization.yaml` and check the release notes for the supported Kubernetes versions.
Run `diff`, then `apply`.

## Upgrading Terraform or providers

The Terraform version is pinned in the workflow (`TF_VERSION`), and provider versions in `envs/*/versions.tf`. After a provider bump, regenerate the lock file for every platform the team uses and commit it:

```bash
cd infra/deploy/parser/terraform/envs/staging
terraform init -backend=false -upgrade
terraform providers lock -platform=linux_amd64 -platform=darwin_arm64 -platform=darwin_amd64 -platform=windows_amd64
```
