# ADR-0015: One Live Environment for UKMA Data, Promoted from Staging

## Status

Proposed

## Date

2026-11-14

## Context

The [deployment spec](../../parser-service/deployment-infrastructure.md) planned two UKMA Data environments on separate clusters: a k3s staging node (4 GB) for testing and a kubeadm production node (16 GB) for live use. Staging exists today: one `cx23` VM at `data.staging.rateukma.com`, provisioned by Terraform and set up by Parser Platform, with observability from [ADR-0014](./0014-parser-observability.md). Production was never built.

**Forces:**

- **No sandbox for the data source.** САЗ and smart.ukma have no test instance. Staging signs in to the real САЗ with a real account and crawls the same pages live would, so a second environment tests nothing that live doesn't already run.
- **Two crawls for the same data.** Each worker runs a daily crawl of about 19,000 pages, roughly 6 hours ([`infra/deploy/parser/README.md`](../../../infra/deploy/parser/README.md)). Two environments would double the load on a system we don't own, from the same account, and produce identical snapshots.
- **The staging node is already hardened.** It has Secrets encryption at rest, a tunnel-only deploy user, a least-privilege deployer, delete and rebuild protection, and alerts on disk, memory, certificates and crawl health.
- **No budget.** A second VM and a second set of secrets and environments cost money and upkeep for a team of students.
- **No consumers yet.** No client in this repo calls the UKMA Data API, so the host can change now without breaking anyone.

## Decision

We will run one UKMA Data environment, `live`, on the existing staging node, and serve it at `data.rateukma.com`. We will not build the kubeadm production cluster.

- The node, its disk, the `parser-db` cluster and its data stay as they are. Only names change: the Terraform root `envs/live` (state key `live/terraform.tfstate`), the server `parser-live`, the overlay `overlays/live`, the Alloy label `cluster="parser-live"`, and the GitHub Environments `Parser Plan`, `Parser` and `Parser Deploy`.
- The parser workflows drop their `environment` input, since there is only one target.
- `data.staging.rateukma.com` is removed with the switch, not kept as an alias.
- A parser change is checked before live by its tests, by `docker compose --profile dev` locally, and by the PR checks (kustomize render, kubeconform, `terraform validate`). The migrate Job and the health check in Deploy Parser are the last gate.

The migration steps are in [`docs/runbooks/parser-staging-to-live.md`](../../runbooks/parser-staging-to-live.md).

## Consequences

* ✅ One crawl against САЗ instead of two, and no duplicate snapshots.
* ✅ One VM, one state file and one set of environments and secrets to keep up.
* ✅ No rebuild: the node keeps its data and hardening, so going live is a rename.
* ⚠️ No place to rehearse a migration, operator upgrade or k3s upgrade before live. A bad change reaches consumers directly. Keep migrations backward compatible with the running image, run Parser Platform `diff` before every `apply`, and treat Postgres backups (#772) as a blocker for relying on the data.
* ⚠️ Live keeps the 4 GB node and k3s, not the planned 16 GB node and kubeadm. A heavier workload needs a bigger `server_type` (an in-place resize) before it needs another cluster.
* ⚠️ `Parser Plan` holds the admin kubeconfig without a reviewer, and that is now live's cluster-admin. Its branch policy must stay `main` only. A reviewer on it or a read-only identity for the diff would close the gap.
* ⚠️ GitHub can't rename an environment or copy its secrets, so every secret is set again in the new environments.
* ⚠️ Metrics and logs change label from `parser-staging` to `parser-live`, so dashboards break at the switch until they are updated, and history before the switch stays under the old label until retention drops it.
* ❌ The deployment spec's two-environment isolation (separate failure domains) no longer applies: there is only one domain.

## Considered Alternatives

1. **Keep staging and build production as the spec planned.**
   - Pros: a place to test platform and migration changes before live.
   - Cons: two crawls against the same source, a second VM, double the secrets and upkeep; staging still couldn't test anything against a different САЗ.
   - Rejection Reason: the duplication costs more than the rehearsal is worth when both sides read the same source.

2. **Keep staging, but with its worker turned off or fed a copy of live's snapshots.**
   - Pros: no second crawl; still a cluster to rehearse upgrades on.
   - Cons: still a second VM and set of environments; a data-sync job or fixtures to maintain; it can't test the crawler itself, which is most of what changes.
   - Rejection Reason: most of the cost of a second environment for little of its value.

3. **Build a new live node and retire staging.**
   - Pros: a clean node named for its role, possibly on the planned kubeadm.
   - Cons: a full rebuild, a database move and a fresh crawl, for a node that already meets the requirements.
   - Rejection Reason: a rename gets the same result without the risk or the downtime.
