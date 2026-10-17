import { assert, describe, layer } from "@effect/vitest";
import { Deferred, Effect, Fiber, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { TestDatabase, testDatabaseUrl } from "../db/testDatabase.ts";
import { CrawlStore, type QueuedPage } from "./CrawlStore.ts";
import { snapshotOf } from "./snapshot.ts";

const TestLive = CrawlStore.layer.pipe(
	Layer.provideMerge(TestDatabase(testDatabaseUrl ?? "")),
);

const FIRST: QueuedPage = { kind: "catalog", path: "/course/catalog?page=1" };

const course = (code: string): QueuedPage => ({
	kind: "course",
	path: `/course/${code}`,
});

/** Empties the crawl tables, so each test starts without runs. */
const reset = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`TRUNCATE runs, run_pages, page_snapshots RESTART IDENTITY`;
});

/** Starts a run whose first page links to `next`, with the first page done. */
const startWith = (next: ReadonlyArray<QueuedPage>) =>
	Effect.gen(function* () {
		const store = yield* CrawlStore;

		const [run] = yield* store.startRuns([
			{ sourcePart: "saz-courses:2031-32", first: FIRST },
		]);

		const first = yield* store.claim(run.id);

		assert.isDefined(first);
		yield* store.complete(run.id, first, snapshotOf("<html></html>"), next);

		return run;
	});

/** A run of one page with this body, done. */
const fetchOnce = (path: string, body: string) =>
	Effect.gen(function* () {
		const store = yield* CrawlStore;

		const [run] = yield* store.startRuns([
			{ sourcePart: "saz-courses:2031-32", first: course(path) },
		]);

		const page = yield* store.claim(run.id);

		assert.isDefined(page);
		yield* store.complete(run.id, page, snapshotOf(body), []);

		return run.id;
	});

const pagesOf = (runId: bigint) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const rows = yield* sql<{
			readonly path: string;
			readonly status: string;
			readonly attempts: number;
			readonly error: string | null;
		}>`
			SELECT path, status, attempts, error FROM run_pages
			WHERE run_id = ${runId}
			ORDER BY id
		`;

		return rows.map(
			({ path, status, attempts, error }) =>
				`${status} ${attempts} ${path}${error === null ? "" : ` ${error}`}`,
		);
	});

describe.skipIf(testDatabaseUrl === undefined)("CrawlStore", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect("gives concurrent claimers different pages", () =>
			Effect.gen(function* () {
				yield* reset;

				const store = yield* CrawlStore;

				const codes = Array.from({ length: 40 }, (_, index) =>
					String(100001 + index),
				);

				const run = yield* startWith(codes.map(course));

				const claimAll = Effect.gen(function* () {
					const claimed: Array<string> = [];
					let page = yield* store.claim(run.id);

					while (page !== undefined) {
						claimed.push(page.path);
						page = yield* store.claim(run.id);
					}

					return claimed;
				});

				const claimed = yield* Effect.all(
					Array.from({ length: 4 }, () => claimAll),
					{ concurrency: "unbounded" },
				);

				assert.deepStrictEqual(
					claimed.flat().sort(),
					codes.map((code) => `/course/${code}`),
				);
			}),
		);

		it.effect("skips a page another claimer holds instead of waiting", () =>
			Effect.gen(function* () {
				yield* reset;

				const sql = yield* SqlClient.SqlClient;
				const store = yield* CrawlStore;
				const run = yield* startWith([course("100001"), course("100002")]);
				const held = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();

				const holder = yield* Effect.forkChild(
					sql`
						SELECT id FROM run_pages WHERE path = '/course/100001' FOR UPDATE
					`.pipe(
						Effect.andThen(Deferred.succeed(held, undefined)),
						Effect.andThen(Deferred.await(release)),
						sql.withTransaction,
					),
				);

				yield* Deferred.await(held);

				const page = yield* store
					.claim(run.id)
					.pipe(
						Effect.timeout("2 seconds"),
						Effect.ensuring(Deferred.succeed(release, undefined)),
					);

				yield* Fiber.join(holder);

				assert.strictEqual(page?.path, "/course/100002");
			}),
		);

		it.effect("stores a snapshot only when the path's content changed", () =>
			Effect.gen(function* () {
				yield* reset;

				const sql = yield* SqlClient.SqlClient;
				const store = yield* CrawlStore;

				const runs = yield* Effect.forEach(
					["first", "first", "second", "first"],
					(body) => fetchOnce("100001", `<html>${body}</html>`),
				);

				const stored = yield* Effect.forEach(runs, (runId) =>
					store
						.report(runId)
						.pipe(
							Effect.map(({ pages }) =>
								pages.reduce((sum, tally) => sum + tally.stored, 0),
							),
						),
				);

				const kept = yield* sql<{ readonly runId: bigint }>`
					SELECT s.run_id AS "runId" FROM run_pages p
					JOIN page_snapshots s ON s.id = p.snapshot_id
					ORDER BY p.id
				`;

				assert.deepStrictEqual(stored, [1, 0, 1, 1]);
				assert.deepStrictEqual(
					kept.map(({ runId }) => runId),
					[runs[0], runs[0], runs[2], runs[3]],
				);
			}),
		);

		it.effect("queues a linked page once per run", () =>
			Effect.gen(function* () {
				yield* reset;

				const store = yield* CrawlStore;

				const run = yield* startWith([
					course("100001"),
					FIRST,
					course("100001"),
				]);

				const page = yield* store.claim(run.id);

				assert.isDefined(page);
				yield* store.complete(run.id, page, snapshotOf("<html></html>"), [
					FIRST,
					course("100001"),
				]);

				assert.deepStrictEqual(yield* pagesOf(run.id), [
					`done 1 ${FIRST.path}`,
					"done 1 /course/100001",
				]);
				assert.isUndefined(yield* store.claim(run.id));
			}),
		);

		it.effect("puts the pages a crash left claimed back in the queue", () =>
			Effect.gen(function* () {
				yield* reset;

				const store = yield* CrawlStore;
				const crashed = yield* startWith([course("100001")]);
				const failed = yield* startWith([course("100002")]);

				yield* store.claim(crashed.id);
				yield* store.claim(failed.id);
				yield* store.finishRun(failed.id, "failed", {
					seconds: 0,
					pages: [],
					failures: [],
				});

				const open = yield* store.openRuns;

				assert.deepStrictEqual(open, [crashed]);
				assert.deepStrictEqual(yield* pagesOf(crashed.id), [
					`done 1 ${FIRST.path}`,
					"pending 0 /course/100001",
				]);
				assert.deepStrictEqual(yield* pagesOf(failed.id), [
					`done 1 ${FIRST.path}`,
					"claimed 1 /course/100002",
				]);
				const reclaimed = yield* store.claim(crashed.id);

				assert.strictEqual(reclaimed?.path, "/course/100001");

				if (reclaimed !== undefined) yield* store.fail(reclaimed, "HTTP 429");

				assert.strictEqual(yield* store.requeue(crashed.id, ["HTTP 429"]), 1);
			}),
		);

		it.effect("counts the time a crash was down in the run's seconds", () =>
			Effect.gen(function* () {
				yield* reset;

				const sql = yield* SqlClient.SqlClient;
				const store = yield* CrawlStore;

				const [run] = yield* store.startRuns([
					{ sourcePart: "saz-courses:2031-32", first: FIRST },
				]);

				// The crash hit the first page an hour ago.
				yield* store.claim(run.id);
				yield* sql`
					UPDATE run_pages SET claimed_at = claimed_at - interval '1 hour'
					WHERE run_id = ${run.id}
				`;
				yield* store.openRuns;
				yield* store.claim(run.id);

				const { seconds } = yield* store.report(run.id);

				assert.isAtLeast(seconds, 3600);
			}),
		);

		it.effect("requeues a page that failed once with a passing error", () =>
			Effect.gen(function* () {
				yield* reset;

				const store = yield* CrawlStore;
				const run = yield* startWith([course("100001"), course("100002")]);

				const failNext = (error: string) =>
					store
						.claim(run.id)
						.pipe(
							Effect.flatMap((page) =>
								page === undefined ? Effect.void : store.fail(page, error),
							),
						);

				yield* failNext("HTTP 429");
				yield* failNext("HTTP 500");

				const first = yield* store.requeue(run.id, ["HTTP 429"]);
				const afterFirst = yield* pagesOf(run.id);

				yield* failNext("HTTP 429");

				const second = yield* store.requeue(run.id, ["HTTP 429"]);

				assert.strictEqual(first, 1);
				assert.deepStrictEqual(afterFirst, [
					`done 1 ${FIRST.path}`,
					"pending 1 /course/100001",
					"failed 1 /course/100002 HTTP 500",
				]);
				assert.strictEqual(second, 0);
				assert.deepStrictEqual(yield* pagesOf(run.id), [
					`done 1 ${FIRST.path}`,
					"failed 2 /course/100001 HTTP 429",
					"failed 1 /course/100002 HTTP 500",
				]);
			}),
		);

		it.effect("lets one crawl hold the lock at a time", () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const store = yield* CrawlStore;

				const [first, second] = yield* Effect.scoped(
					Effect.all([store.lockCrawl, Effect.scoped(store.lockCrawl)]),
				);

				// A pooled session takes its own lock again, so the release is
				// checked in pg_locks rather than by locking once more.
				const [{ held }] = yield* sql<{ readonly held: number }>`
					SELECT count(*)::int AS held FROM pg_locks
					WHERE locktype = 'advisory'
						AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
				`;

				assert.deepStrictEqual([first, second, held], [true, false, 0]);
			}),
		);
	});
});
