# ADR-0007: Migrate Deployment from AWS EC2 to Hetzner Cloud

## Status

Accepted — partially supersedes [ADR-0002: Initial Deployment Strategy](./0002-initial-deployment-strategy.md) (infrastructure provider, instance sizing, planned secrets storage, and backup posture). Decisions in ADR-0002 about Docker, environment separation, Nginx, Let's Encrypt, and GitHub Actions for CI/CD remain in force.

## Date

2026-05-16

## Context

ADR-0002 selected AWS EC2 as the hosting provider for a single-instance deployment per environment. After ~8 months in production, the project is hitting cost constraints that were not anticipated at the time of ADR-0002.

**Forces:**

1. **Cost pressure**
   - AWS billing for `t3.small` (live) + `t3.micro` (staging) + EBS storage + data transfer + Route 53 runs ~$40-50/month.
   - Budget is funded by the team itself; a 3–4× reduction materially extends the runway.
   - Equivalent Hetzner Cloud VMs (CX22, 2 vCPU / 4GB / 40GB SSD) are €4.50/month each, ~10× cheaper for similar specs.

2. **Operational simplicity remains a goal**
   - Same constraints as ADR-0002: small student team, basic DevOps experience.
   - We do not want to add managed-service complexity (RDS, ALB, ECS) — the simple "Docker on a VM" model from ADR-0002 has worked.

3. **Same non-functional requirements still apply**
   - [NFR-R-002](../requirements.md#nfr-r-002): 99.5% monthly uptime.
   - [NFR-R-004](../requirements.md#nfr-r-004): daily backups with 7-day retention.
   - [NFR-PE-001](../requirements.md#nfr-pe-001): page load < 1.5 seconds.

4. **Service knowledge accumulated since ADR-0002**
   - AWS SSM/Secrets Manager was specified in ADR-0002 §3 but never actually adopted; secrets have lived in GitHub Actions and a server-side `.env` from day one.
   - The backup EC2 instance from ADR-0002 was provisioned but never wired into a working backup pipeline.
   - The deployment script (`scripts/ci/deploy.sh`) is provider-agnostic — only the SSH target and image pull behaviour change.

## Decision

We will migrate both environments to **Hetzner Cloud** VMs in the `nbg1` (Nuremberg) region, keeping the single-instance-per-environment model.

1. **Infrastructure**
   - Staging: Hetzner CX22 (2 vCPU AMD, 4 GB RAM, 40 GB NVMe SSD).
   - Live: Hetzner CX22 (same spec as staging).
     - Sizing matched to staging because current load fits comfortably; we will upsize to CX32 (8 GB) only if observed memory/CPU justifies it.
   - Ubuntu 24.04 LTS on both (upgraded from 22.04 in ADR-0002 — fresh installs as part of migration).
   - All application components remain containerized via Docker Compose (`profiles: prod`).

2. **Migration mechanism**
   - One-shot workflow `.github/workflows/migrate.yml` provisions the new VM (Docker, Nginx, Certbot, jq), uploads the deploy artifacts, restores a `pg_dump` from the old server, and starts services.
   - TLS issued via `.github/workflows/enable-tls.yml` after DNS cutover (separate step because cert challenge needs the new IP active in DNS).
   - The ongoing deploy pipeline (`.github/workflows/deploy.yml`) is unchanged in shape — only the SSH target moves.
   - All migration components are to be cleaned up after migration is complete - they are all present in Git history if need to be reused.

3. **Secrets**
   - We formalize the current practice and drop the unimplemented AWS SSM/Secrets Manager plan from ADR-0002 §3.
   - Secrets live as **GitHub Environment secrets** (per `Live` / `Staging` environments), and a single `APP_DOTENV` secret holds the full `.env` content for the server.
   - On deploy, `APP_DOTENV` is written to `/opt/rateukma/.env` on the VM.
   - Trade-off: no central rotation/audit, but a single source of truth that matches who actually has merge access to the deployment workflows.

4. **Network & TLS**
   - Hetzner Cloud Firewall used in place of AWS Security Groups: SSH 22, HTTP 80, HTTPS 443 open to the world; Postgres (5432) only inside the Docker network.
   - TLS via Let's Encrypt / Certbot (`--standalone` to obtain cert, files copied from `certbot-nginx` package, then production nginx template applied). HSTS + modern ciphers retained from ADR-0002.

5. **Backups**
   - **Backups are explicitly deferred** (regression vs. ADR-0002 §3). The separate backup EC2 from ADR-0002 was never wired up; the migration is not the right moment to design the backup pipeline.
   - A dedicated follow-up will pick between Hetzner Storage Box, an S3-compatible bucket (Hetzner Object Storage / Backblaze B2), or a second small VM with `rsync`. Until then, [NFR-R-004](../requirements.md#nfr-r-004) is **not met**.

6. **DNS**
   - `rateukma.com` and `staging.rateukma.com` remain on Route 53. Only the A records are updated to point at the new Hetzner IPs; NS/SOA are unchanged.

## Consequences

✅ **~5× hosting cost reduction**: from ~$40–50/month to ~€10/month for both VMs combined.

✅ **EU residency by default**: Hetzner `nbg1` keeps data inside the EU, naturally aligned with the user base (Ukraine / Kyiv-Mohyla Academy).

✅ **Simpler mental model for the team**: plain VMs + Docker + GitHub Actions; no AWS-specific tooling to learn or pay for.

✅ **Same upgrade path preserved**: containerized setup still allows moving to a load-balanced multi-VM topology later without rewriting the app.

⚠️ **Single Point of Failure remains** — same posture as ADR-0002; one VM per environment.

⚠️ **Live is sized the same as staging.** If real load grows, the live VM must be upsized before we hit memory/CPU saturation. We rely on Hetzner's in-place resize (reboot required) rather than horizontal scaling at this stage.

❌ **No automated backups during the gap.** Loss of the VM means data loss back to the latest manual `pg_dump`. NFR-R-004 is violated until the follow-up backup ADR is implemented. This is an explicit, time-boxed regression.

❌ **Secrets governance stays at the GitHub Environment level** — no rotation, no per-key audit trail, no granular IAM. Same posture as actual (vs. planned) practice under ADR-0002; mitigated by the small number of people with write access to the deployment workflows.

⚠️ **Lock-in to Hetzner's API surface for VM management.** Lower than AWS lock-in, but provisioning automation (if added later) would be Hetzner-specific.

## Considered Alternatives

1. **Stay on AWS, downsize aggressively**
   - Rejected: even with t4g.nano + dropping the backup instance + Reserved Instances, AWS pricing for the same workload is still 3–5× Hetzner. The fixed costs (NAT gateway charges, EBS minimum, data transfer pricing) don't shrink linearly with instance size.

2. **DigitalOcean / Vultr**
   - Rejected: similar pricing tier to Hetzner but no advantage that justifies switching twice. Hetzner has a slight edge on €/GB-RAM and is EU-headquartered.

3. **Managed PaaS (Render, Fly.io, Railway)**
   - Rejected: pricing scales per-container and would exceed Hetzner total once Redis + Postgres + backend + webapp are counted. Also re-introduces vendor-specific deployment knobs that conflict with the "plain Docker Compose" model that has been working.

4. **Self-host on university infrastructure (NaUKMA datacenter)**
   - Rejected: no SLA, no clear operational ownership outside the student team, and historical reliability is unknown.
