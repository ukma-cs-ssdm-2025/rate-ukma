# UKMA Data: Promote Staging to Live

This is a one-time runbook. It turns the UKMA Data staging node into the live environment at `data.rateukma.com`, as decided in [ADR-0015](../architecture/decisions/0015-parser-single-live-environment.md). The VM, its database and its data stay as they are. Only names, the host and the GitHub Environments change.

## Prerequisites

- Admin on the GitHub repo (Settings → Environments).
- Route 53 access for `rateukma.com`.
- The Hetzner parser project's S3 keys and the state encryption key (`TF_STATE_SSE_CUSTOMER_KEY`) from the team password manager.
- The admin SSH key for the node (`deploy@<ipv4>`) and the tunnel key.
- Editor access to the Grafana Cloud stack.
- The PR that renames everything to `live` is approved, but **not merged yet**.

## Steps

### 1. DNS

Add a Route 53 A record `data.rateukma.com` pointing to the node's current IPv4, the same address as `data.staging.rateukma.com`. Keep the old record until step 8.

```bash
dig +short data.rateukma.com   # the node's IPv4
```

### 2. Move the Terraform state

The state moves from `staging/terraform.tfstate` to `live/terraform.tfstate`. The copy runs server-side, so the state never reaches your laptop. The bucket has versioning, and the old object stays until step 8.

```bash
export AWS_ACCESS_KEY_ID=<TF_STATE_ACCESS_KEY> AWS_SECRET_ACCESS_KEY=<TF_STATE_SECRET_KEY>
# The secret is base64; the AWS CLI wants the 32 raw bytes, so read them from a file.
KEY_FILE=$(mktemp) && echo '<TF_STATE_SSE_CUSTOMER_KEY>' | base64 -d > "$KEY_FILE"
S3="aws s3api --endpoint-url https://hel1.your-objectstorage.com --region hel1"
SSE="--sse-customer-algorithm AES256 --sse-customer-key fileb://$KEY_FILE"
$S3 copy-object --bucket rate-ukma-parser-tfstate \
  --copy-source rate-ukma-parser-tfstate/staging/terraform.tfstate --key live/terraform.tfstate \
  $SSE --copy-source-sse-customer-algorithm AES256 --copy-source-sse-customer-key "fileb://$KEY_FILE"
$S3 head-object --bucket rate-ukma-parser-tfstate --key live/terraform.tfstate $SSE   # ContentLength matches staging/
rm -f "$KEY_FILE"; unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY KEY_FILE
```

Step 5 shows whether the copy is right: the plan must only rename.

### 3. GitHub Environments

GitHub can't rename an environment or read a secret back, so create three new environments and set every secret again from its source. For each environment, under **Deployment branches and tags**, choose **Selected branches and tags** and allow only `main`.

| Environment | Reviewer | Secrets |
| --- | --- | --- |
| `Parser Plan` | none | `HCLOUD_TOKEN` (read-only), `TF_STATE_ACCESS_KEY`, `TF_STATE_SECRET_KEY`, `TF_STATE_SSE_CUSTOMER_KEY`, `TF_PLAN_ENCRYPTION_KEY`, `PARSER_SSH_PUBLIC_KEY`, `PARSER_TUNNEL_SSH_PUBLIC_KEY`, `PARSER_SSH_KEY`, `PARSER_SSH_HOST`, `PARSER_SSH_KNOWN_HOSTS`, `PARSER_KUBECONFIG` |
| `Parser` | required | `HCLOUD_TOKEN` (read & write), the four `TF_*` keys, `PARSER_SSH_KEY`, `PARSER_SSH_HOST`, `PARSER_SSH_KNOWN_HOSTS`, `PARSER_KUBECONFIG`, `PARSER_GHCR_PULL_USER`, `PARSER_GHCR_PULL_TOKEN`, `PARSER_CORPORATE_EMAIL`, `PARSER_CORPORATE_PASSWORD`, `GRAFANA_CLOUD_TOKEN`, `GRAFANA_PROM_URL`, `GRAFANA_PROM_USER`, `GRAFANA_LOKI_URL`, `GRAFANA_LOKI_USER` |
| `Parser Deploy` | none | `PARSER_SSH_HOST`, `PARSER_SSH_KNOWN_HOSTS`, `PARSER_TUNNEL_SSH_KEY`, `PARSER_DEPLOY_KUBECONFIG` |

The node is unchanged, so the keys and kubeconfigs are the ones staging used. Read the node-side values again over SSH with the commands in [`infra/deploy/parser/README.md`](../../infra/deploy/parser/README.md):

- the host key and `PARSER_SSH_HOST`: "Before the first run";
- the admin kubeconfig: "After the first `apply`";
- the deployer kubeconfig: "Before the first deploy", step 6.

Check that nothing is missing:

```bash
for ENV in "Parser Plan" "Parser" "Parser Deploy"; do echo "== $ENV"; gh secret list --env "$ENV"; done
```

### 4. Merge the PR

The parser workflows now use only the new environments. The merge doesn't touch the node: parser deploys run only on dispatch.

### 5. Terraform

**Actions → Provision Parser VM → Run workflow**, `action: plan`. Check the summary:

- `Plan: 0 to add, 3 to change, 0 to destroy`;
- `hcloud_server`, `hcloud_firewall` and `hcloud_ssh_key` are updated in place: `parser-staging` becomes `parser-live`, and `env = "staging"` becomes `env = "live"`.

Anything to add or destroy means the state copy is wrong: stop and go back to step 2. Otherwise, run it again with `action: apply` and approve it in `Parser`.

### 6. Platform

**Actions → Parser Platform → Run workflow**, `action: diff`. The only change should be Alloy's config (`cluster = "parser-live"`). Run it again with `apply`.

Just after the apply, update the Grafana dashboard **UKMA Data Staging** (uid `aarqld6`):

- rename it to **UKMA Data**;
- in all 11 panel queries, replace `cluster="parser-staging"` with `cluster="parser-live"`.

Data from before the switch stays under the old label until its 14-day retention runs out.

### 7. Deploy

**Actions → Deploy Parser → Run workflow** with the current parser version. cert-manager issues a new `parser-api-tls` certificate for `data.rateukma.com`, and the health step waits for it.

```bash
curl -sI https://data.rateukma.com/health                  # HTTP/2 200, trusted certificate
sudo k3s kubectl -n parser get certificate parser-api-tls   # READY True
sudo k3s kubectl -n parser logs deploy/parser-worker        # resumes or waits for the next crawl
```

The rollout restarts the worker. It resumes a crawl it interrupted, so no crawl is lost.

### 8. Clean up

Wait at least a day after step 7, until the dashboard shows a successful crawl under `parser-live`. Then:

- delete the Route 53 record `data.staging.rateukma.com`;
- delete the `Parser Staging Plan`, `Parser Staging` and `Parser Staging Deploy` environments;
- delete `staging/terraform.tfstate` from the bucket (older versions stay until the versioning rules remove them).

## Rollback

- **Before step 5:** revert the PR. The old environments and the old state object are still there, and the new DNS record does no harm.
- **After step 5:** Terraform has only renamed things. Revert the PR, copy `live/terraform.tfstate` back to `staging/` (step 2 with the keys swapped), and run Provision Parser VM, Parser Platform and Deploy Parser against the old names.
