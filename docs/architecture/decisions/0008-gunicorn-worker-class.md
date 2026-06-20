# ADR-0008: Gunicorn Worker Class — Move from `gthread` to `sync`

## Status

Proposed

## Date

2026-06-14

## Context

The live backend exhibited intermittent 8–20s stalls while the server was
otherwise idle (CPU ~0%, load 0.14, database idle). Investigation (issue
[#609](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/609)) traced this to
a **socket leak**: connections piling up in the `CLOSE_WAIT` state inside the
gunicorn backend container (905 leaked sockets observed over ~5 days,
concentrated on 2 of 5 workers, one worker at 530/1024 file descriptors). The
clogged workers spent their time scanning dead sockets in their selector loop
instead of serving requests, producing the stalls.

The root defect lives in gunicorn's **`gthread`** worker: it keeps a pool of
idle keep-alive connections registered in a `selectors` poller, and when a peer
half-closes such a connection it does not reliably `close()` its own end (see
gunicorn [#1976](https://github.com/benoitc/gunicorn/issues/1976),
[#2297](https://github.com/benoitc/gunicorn/issues/2297), and nginx trac
[#2145](https://trac.nginx.org/nginx/ticket/2145)). The precondition is always
*an idle keep-alive connection that the peer closes*.

Two earlier fixes removed the **triggers** but not the defect:

- **PR [#610](https://github.com/ukma-cs-ssdm-2025/rate-ukma/pull/610)** disabled
  nginx → gunicorn upstream keep-alive (`keepalive 16` removed, upstream
  `Connection: close`). This stopped nginx from holding idle reusable upstream
  connections — the ~14% of the leak that came from nginx.
- **PR [#612](https://github.com/ukma-cs-ssdm-2025/rate-ukma/pull/612)** bound all
  published container ports (`8000`, `5432`, `6379`) to `127.0.0.1`. Gunicorn's
  `:8000` had been reachable from the public internet; abandoned scanner/bot
  connections were ~86% of the leak. (This also closed an unrelated data-layer
  exposure: an internet-reachable, password-less Redis.)

After both fixes the box is healthy, but health now **depends on that config
holding**: re-introducing upstream keep-alive or re-exposing the port would
revive the leak, because the `gthread` defect itself is still present.

**Forces:**

- The leak's only home is the `gthread` keep-alive connection pool.
- With nginx already sending upstream `Connection: close`, gunicorn-side
  keep-alive on the upstream hop provides **no benefit** — nginx closes each
  upstream connection after one request regardless.
- The deployment target is small and I/O-bound: **2 vCPU / 4 GB** (Hetzner),
  serving an aggressively Redis-cached Django app (DB and Redis reached over the
  Docker network; nginx terminates TLS and buffers requests/responses in front).
- Measured load is modest: peak arrival *to gunicorn* ≈ **19 req/s** in the
  busiest single second (including scanner `400`s), busiest minute ≈ 244 req/min
  (~4/s average); fast/cached responses measured at **~7–12 ms** through nginx.
  Observed peak **concurrency** ≈ 50 — but that is *edge connections* (TLS +
  keep-alive idle + the SPA firing ~7 API calls per page load), not simultaneous
  in-worker execution. By Little's Law, simultaneous work inside gunicorn at peak
  is single digits.

## Decision

We will switch the gunicorn worker class from **`gthread` to `sync`**, and raise
the worker count to compensate for the loss of per-worker threads.

In `src/backend/django-entrypoint.sh`:

- `--worker-class gthread` → `--worker-class sync`.
- Remove `--threads` (ignored by the sync worker).
- Remove `--keep-alive 5` (ignored by the sync worker; sync closes every
  connection after one request, which matches the nginx upstream
  `Connection: close` already in place).
- Change the worker formula from `2·cores + 1` to `4·cores + 1`, keeping the
  existing memory ceiling (`AVAILABLE_MEMORY_MB / 150`). On the 2-vCPU / 4 GB
  live box this yields **9 workers** (memory cap ≈ 27, so cores govern),
  restoring the concurrency previously provided by `5 workers × 2 threads = 10`
  slots while every slot is now an independent process.

The `sync` worker has **no persistent keep-alive connection pool**, so the
`CLOSE_WAIT` accumulation is structurally impossible — this removes the bug class
rather than starving it of triggers.

## Consequences

### Positive

- ✅ **Eliminates the leak at the root.** No keep-alive pool ⇒ no idle
  half-closed sockets ⇒ no `CLOSE_WAIT` accumulation, independent of nginx or
  firewall configuration.
- ✅ **No loss of function.** Upstream keep-alive was already disabled
  (`Connection: close`), so sync's per-request connection close costs nothing on
  the only hop that talks to gunicorn.
- ✅ **Health no longer depends on load-bearing config.** PRs #610/#612 become a
  defense-in-depth nicety rather than the only thing preventing worker wedging.
- ✅ **Concurrency preserved.** `4·cores + 1 = 9` sync workers ≈ the previous 10
  gthread slots, now without intra-process GIL contention.
- ✅ Simpler model: one request per worker is easier to reason about; nginx
  already buffers slow clients, neutralizing sync's classic weakness.

### Negative / Trade-offs

- ⚠️ **A blocking request occupies a whole worker** for its full duration.
  The relevant case is the Microsoft OAuth token exchange in
  `/accounts/microsoft/login/callback/` (a server-side round-trip to Microsoft,
  ~hundreds of ms). Under gthread the worker's *other* thread kept serving; under
  sync the worker is fully held. Raising workers to `4·cores+1` is the
  mitigation; a start-of-semester login burst is the scenario to watch.
- ⚠️ **CPU-bound parallelism is still capped at the core count** (2). Extra
  workers only hide I/O wait, not CPU work — true for any config on this box.
- ⚠️ **Higher memory footprint** from more processes (~9 × ≤150 MB ≈ ≤1.35 GB;
  lower in practice thanks to `--preload` copy-on-write). Comfortable on 4 GB,
  and still bounded by the existing memory cap.
- ⚠️ The `--timeout 300` setting means a hung request holds a worker for up to
  5 minutes; with more workers this is less risky, but the long timeout is worth
  revisiting separately.

### Validation / Success Criteria

- After deploy, `CLOSE_WAIT` socket count in the backend container stays flat
  over days (previously climbed to hundreds):
  `awk 'NR>1{print $4}' /proc/net/tcp /proc/net/tcp6 | sort | uniq -c` — expect
  `08` (CLOSE_WAIT) to remain negligible.
- Per-worker file-descriptor counts stay low and even across workers.
- No regression in P50/P95 API latency under normal and login-burst traffic.

## Considered Alternatives

### Alternative 1: Keep `gthread`, rely on PRs #610 + #612

Leave the worker class unchanged and trust that removing the triggers (upstream
keep-alive off, ports bound to loopback) keeps the leak dormant.

**Pros:**

- No change; keeps per-worker thread concurrency for blocking I/O.

**Cons:**

- The defect remains in the code; health is permanently contingent on config
  that a future change could silently undo (re-enable upstream keep-alive,
  re-expose a port).

**Reason for rejection:** Leaves a latent failure mode in place for a benefit
(upstream keep-alive) we no longer use.

### Alternative 2: `gevent` / `eventlet` async workers

Greenlet-based async workers with monkey-patching for high I/O concurrency.

**Pros:**

- Very high concurrency for I/O-bound workloads.

**Cons:**

- Requires monkey-patching the standard library, which can interact badly with
  psycopg, native extensions, and Django internals; adds debugging surface for a
  workload that does not need that level of concurrency.

**Reason for rejection:** Disproportionate complexity and risk for ~19 req/s
peak; introduces a different class of subtle bugs.

### Alternative 3: `uvicorn` ASGI worker

Move to ASGI (`rateukma.asgi`) under a uvicorn worker — a real async event loop,
no gthread reaper, and reportedly ~36% faster (issue #609 follow-up).

**Pros:**

- No keep-alive reaper bug; better throughput; would allow re-enabling upstream
  reuse if the backend ever moves off-host.

**Cons:**

- WSGI → ASGI is a **migration, not a flag flip**: changes middleware execution,
  runs sync views via a `sync_to_async` threadpool, and requires auditing any
  blocking I/O in middleware/signals.

**Reason for rejection (for now):** Correct long-term direction, but out of scope
for fixing #609. Tracked as a separate follow-up; this ADR can be superseded if
and when the ASGI migration is undertaken.

## References

- Issue [#609](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/609) —
  gunicorn `gthread` + nginx upstream keep-alive `CLOSE_WAIT` socket leak
- PR [#610](https://github.com/ukma-cs-ssdm-2025/rate-ukma/pull/610) — disable
  nginx → gunicorn upstream keep-alive
- PR [#612](https://github.com/ukma-cs-ssdm-2025/rate-ukma/pull/612) — bind
  published container ports to loopback
- gunicorn [#1976](https://github.com/benoitc/gunicorn/issues/1976),
  [#2297](https://github.com/benoitc/gunicorn/issues/2297)
- nginx trac [#2145](https://trac.nginx.org/nginx/ticket/2145)
- [ADR-0007](0007-hetzner-deployment.md) — Hetzner deployment target
