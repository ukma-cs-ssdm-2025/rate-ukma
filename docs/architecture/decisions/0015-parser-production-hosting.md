# ADR-0015: UKMA Data Production Hosting on k3s

## Status

Proposed

Supersedes the production sizing and Kubernetes distro lines of the [deployment spec](../../parser-service/deployment-infrastructure.md) (16 GB, kubeadm). Fulfils the requirement of [ADR-0011](./0011-saz-data-service.md) that production hosting gets its own ADR. Builds on [ADR-0007](./0007-hetzner-deployment.md) (Hetzner, one environment per VM) and [ADR-0014](./0014-parser-observability.md) (observability).

## Date

2026-11-12

## Context

UKMA Data runs only on staging: a single-node k3s cluster on a `cx23` (2 vCPU, 4 GB). Nothing exists for live. The spec budgeted live at 16 GB with kubeadm, a number written before anything was measured. ADR-0011 says production hosting needs its own ADR before it goes live.

**Forces:**

- **Measured load.** The parser is light: plain HTTP, one request at a time with a 1 s gap, one page in memory, no browser. The crawl is bound by the request gap, so more CPU does not make it faster.
- **Isolation.** ADR-0007 keeps staging and live failures apart. The parser also needs its own Hetzner project, so its tokens cannot reach the main app's servers.
- **Parity.** Live should run what staging tests.
- **Cost.** The team pays for the VMs; each size step roughly doubles the monthly price.
- **Growth.** `page_snapshots` grows only when a page changes, but `run_pages` adds about 52k rows per crawl and is never pruned. Backups, a keyed `/v1` API and a smart.ukma crawl will share the node later.

**Measured on staging** (Grafana Cloud, 7 days, including one full 9-year crawl):

| Metric | Value |
| --- | --- |
| Node | cx23: 2 vCPU, 3,820 MiB RAM, 37 GiB disk |
| RAM used at peak | about 2,260 MiB (available never below 1,561 MiB) |
| All pods, sum of 7-day peaks | about 800 MiB |
| OS, k3s and containerd | about 1,400 MiB |
| Postgres pods, peak | 236 and 196 MiB (limit 512 MiB each) |
| CPU | 12% average, 59% peak |
| Disk | 8.4 GiB of 37 GiB used |
| `parser` database | 281 MiB after one full crawl (52.4k pages), flat since |
| OOM events | 0 |

Disk growth on live is an estimate, not a measurement: 10–15 MB per crawl, up to about 5 GB a year with daily crawls. With two Postgres instances, the 2 GB WAL cap and about 8 GB for the OS and images, that is roughly 25–30 GB after a year of daily crawls.

## Decision

We will run live on **one Hetzner `cx33` (4 vCPU, 8 GB, 80 GB) in `hel1`, with single-node k3s**, in the parser's own Hetzner project.

- **Separate VM and cluster** from staging, with its own Terraform state (`live/terraform.tfstate`), GitHub Environments (`Parser Live Plan`, `Parser Live`, `Parser Live Deploy`), SSH keys and kubeconfigs.
- **Host** `data.rateukma.com`.
- **Same manifests.** The platform manifests and the app base are shared with staging. Only the app overlay (host) and Alloy's `cluster` label (`CLUSTER_NAME`, from the `grafana-cloud` Secret) differ per environment.
- **Automatic deploys.** A push to `main` that changes `src/parser` or the parser app manifests deploys to staging, and then to live if staging succeeded. This runs from the main pipeline, independent of the web app's Live Build.
- **Resizing.** Hetzner resizes a server upward in place with a reboot, so starting at `cx33` does not close off 16 GB.

## Consequences

* ✅ Live runs the distro and manifests staging tests. No new Terraform module: `modules/k3s-node` is reused.
* ✅ About 5.5 GiB of RAM free at the measured peak; the disk covers several years of growth; room for backups and a larger Postgres.
* ✅ A failed staging deploy stops the live deploy.
* ⚠️ **No backups yet.** Losing the VM loses the snapshot history. Current data can be re-crawled in about 15 hours. Follow-up: CNPG backups to Hetzner Object Storage with a restore test.
* ⚠️ **Crawl frequency equals deploy frequency.** Every parser merge restarts the worker, and with no open run that starts a full crawl (about 15 hours), now on two environments with one САЗ account. Follow-up: the daily schedule from the spec.
* ⚠️ **Monitoring** keeps 14 days of data and no alert rules are committed (ADR-0014 covers staging only). A second cluster adds series to the free-tier limit of 10k.
* ⚠️ A node failure takes the database down, as on staging: both Postgres instances share the node.
* ⚠️ About twice the monthly cost of a `cx23`.
* ❌ No HA control plane. Not needed on one node.
* The sizing numbers will be re-measured on live after a week and recorded here.

## Considered Alternatives

1. **kubeadm, as the spec said.**
   - Pros: reference distribution; HA control plane and pluggable components.
   - Cons: etcd and separate control-plane processes cost about 1–1.5 GiB more; Traefik, storage, a CNI and a load balancer must be installed and maintained; secrets encryption needs a hand-written `EncryptionConfiguration`; upgrades need etcd backups and certificate rotation; needs a new Terraform module and cloud-init.
   - Rejection Reason: its advantages matter only with several nodes, which we rule out, and live would differ from staging.

2. **MicroK8s.**
   - Pros: CNCF certified; simple single-node install.
   - Cons: ingress is NGINX, so the Ingress manifests would change; snap auto-refresh has to be pinned; needs its own module and cloud-init.
   - Rejection Reason: same parity and work cost as kubeadm, with no gain over k3s.

3. **`cx23` (2 vCPU, 4 GB, 40 GB), same as staging.**
   - Pros: cheapest; works today with about 1.5 GiB free.
   - Cons: no room for backups, a larger Postgres or a year of disk growth.
   - Rejection Reason: minimum viable only. Upsizing later is possible but needs a reboot.

4. **`cx43` (8 vCPU, 16 GB, 160 GB), the spec's budget.**
   - Pros: the most headroom.
   - Cons: nothing measured uses it; double the cost of `cx33`.
   - Rejection Reason: paying for unused capacity. We can resize in place if needed.
