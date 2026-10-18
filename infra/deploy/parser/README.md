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
        ├── config/       # parser namespace, Let's Encrypt ClusterIssuers
        └── database/     # parser-db Postgres cluster
```

Terraform runs from CI only, via [`.github/workflows/parser-infra.yml`](../../../.github/workflows/parser-infra.yml):

- **Pull requests** touching `terraform/` run `terraform fmt -check` and `terraform validate`. These need no credentials.
- **Actions → Provision Parser VM → Run workflow** runs `plan`, or `plan` followed by `apply`, against the chosen environment:
  1. The **plan** job runs at once and writes the full plan to the run summary.
  2. The **apply** job waits for the reviewer, then applies exactly that plan. It is skipped when the plan has no changes.

  One run per environment at a time, so nothing can change the state between plan and apply.

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
4. **GitHub Environments.** Create two under Settings → Environments (later the same pair for `Live`):

   | Environment | Used by | Required reviewer | `HCLOUD_TOKEN` |
   | --- | --- | --- | --- |
   | `Parser Staging Plan` | plan job | none | **read-only** token |
   | `Parser Staging` | apply job, Parser Platform | yes | read & write token |

   - On both, under **Deployment branches and tags**, pick **Selected branches and tags** and allow only `main`. Otherwise a run from any branch could read the secrets.
   - On `Parser Staging`, leave **Prevent self-review** off if you are the only reviewer.
   - With a read-only token in the plan environment, only an approved run can change Hetzner resources.
   - Add these secrets to both:

     | Secret | Value |
     | --- | --- |
     | `HCLOUD_TOKEN` | Hetzner API token (see the table above) |
     | `TF_STATE_ACCESS_KEY` | S3 access key |
     | `TF_STATE_SECRET_KEY` | S3 secret key |
     | `TF_STATE_SSE_CUSTOMER_KEY` | state encryption key (base64, 32 bytes) |
     | `TF_PLAN_ENCRYPTION_KEY` | plan file encryption key: `openssl rand -base64 32`. The plan is uploaded as an artifact, which anyone signed in to GitHub can download from this public repo |

   The plan job also needs `PARSER_SSH_PUBLIC_KEY` (see below). The apply job doesn't: the saved plan already holds it.

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
2. Add these secrets:

   | Secret | Environment | Value |
   | --- | --- | --- |
   | `PARSER_SSH_PUBLIC_KEY` | `Parser Staging Plan` | contents of `parser-staging.pub` |
   | `PARSER_SSH_KEY` | `Parser Staging` | contents of `parser-staging` (the private key) |

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

   Its client certificate is valid for 1 year. k3s renews it on the node when it starts within 90 days of expiry, but the secret keeps the old copy, and CI then fails with `Unauthorized`. Check the expiry and refresh the secret yearly:

   ```bash
   ssh deploy@<ipv4> sudo cat /etc/rancher/k3s/k3s.yaml | grep client-certificate-data | awk '{print $2}' | base64 -d | openssl x509 -noout -enddate
   ssh deploy@<ipv4> sudo cat /etc/rancher/k3s/k3s.yaml | gh secret set PARSER_KUBECONFIG --env "Parser Staging"
   ```

4. **Admin access from a laptop:** open a tunnel with `ssh -N -L 6443:127.0.0.1:6443 deploy@<ipv4>`, then use the kubeconfig as is.

## Platform add-ons (`k8s/platform`)

Cluster-wide add-ons, applied by [`.github/workflows/parser-platform.yml`](../../../.github/workflows/parser-platform.yml):

- **`operators/`:** upstream cert-manager and CloudNativePG manifests, pinned to exact releases.
- **`config/`:** the `parser` namespace and the `letsencrypt-staging` and `letsencrypt-prod` ClusterIssuers. It needs the operator CRDs, so it is applied second.
- **`database/`:** the `parser-db` Postgres cluster. It needs the CNPG CRDs and the `parser` namespace, so it is applied last.
- **Ingress:** the Traefik bundled with k3s, IngressClass `traefik`. It is not in this folder.

The workflow reaches the API server through [`.github/actions/k8s-tunnel`](../../../.github/actions/k8s-tunnel/action.yml), an SSH tunnel to `127.0.0.1:6443` on the node.
Pull requests only render the kustomizations.
**Actions → Parser Platform → Run workflow** runs `diff`, or `diff` followed by `apply`:
1. The **diff** job runs at once in `Parser Staging Plan` and writes the diff to the run summary.
2. The **apply** job waits for the reviewer in `Parser Staging`, then applies the same commit. It is skipped when there are no changes.

The longer step scripts live in `scripts/ci/parser-platform-*.sh`.

### Before the first run

Both jobs open the tunnel, so add these secrets to **both** `Parser Staging Plan` and `Parser Staging`, next to `PARSER_SSH_KEY` and `PARSER_KUBECONFIG` (which both need too):

| Secret | Value |
| --- | --- |
| `PARSER_SSH_HOST` | the node's `ipv4` |
| `PARSER_SSH_KNOWN_HOSTS` | the node's host key line, `<ipv4> ssh-ed25519 AAAA...` |

Read the host key from the node itself, so there is nothing to compare by hand.
The secret is only written if the key was read, so a failed login leaves the old value in place:

```bash
IP=<ipv4>
KEY=$(ssh deploy@$IP cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub) \
  && [[ $KEY == "ssh-ed25519 "* ]] \
  && gh secret set PARSER_SSH_KNOWN_HOSTS --env "Parser Staging" --body "$IP $KEY"
```

If the VM is recreated, its IP and host key change: update both secrets.

### Check

Run the workflow with `action: apply`.
The run summary should show the cert-manager and CNPG pods `Running`, both ClusterIssuers `True`, and `parser-db` in `Cluster in healthy state`.
A following `diff` run should print no changes.

### Database (`parser-db`)

- **One instance**, Postgres 18 (`imageName` in `database/cluster.yaml`), database and owner `parser`. The standby replica and backups come with #772.
- **Credentials:** CNPG generates them and stores them in the `parser-db-app` Secret. Its `uri` key is the service's `DATABASE_URL`, so no DB password passes through GitHub or Terraform.
- **Storage:** k3s `local-path`, a directory on the node under `/var/lib/rancher/k3s/storage`. Recreating the VM deletes the data.

On the node:

```bash
sudo k3s kubectl -n parser get cluster parser-db               # STATUS: Cluster in healthy state
sudo k3s kubectl -n parser exec -it parser-db-1 -- psql parser  # psql as the postgres superuser
```

Changing `imageName` (a minor Postgres update) or a parameter that needs a restart restarts the instance, so expect a short outage.

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
