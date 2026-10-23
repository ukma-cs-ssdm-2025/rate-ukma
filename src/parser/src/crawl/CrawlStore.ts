import { Context, Effect, Layer, Option, Schema, type Scope } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { CRAWL_LOCK, sessionLock } from "../db/locks.ts";
import type { Snapshot } from "./snapshot.ts";

export const PageKind = Schema.Literals(["catalog", "course", "students"]);

export type PageKind = typeof PageKind.Type;

export interface QueuedPage {
	readonly kind: PageKind;
	readonly path: string;
}

const ClaimedPage = Schema.Struct({
	id: Schema.BigInt,
	kind: PageKind,
	path: Schema.String,
});

export type ClaimedPage = typeof ClaimedPage.Type;

/** One line of a run report: the counts of one page kind, done, failed, and
 *  how many of them stored a new snapshot. */
const PageCounts = Schema.Struct({
	kind: PageKind,
	done: Schema.Number,
	failed: Schema.Number,
	stored: Schema.Number,
});

export type PageCounts = typeof PageCounts.Type;

const PageFailure = Schema.Struct({
	path: Schema.String,
	error: Schema.String,
});

export type PageFailure = typeof PageFailure.Type;

/** `seconds` runs from the first claim, so a resumed run counts the time it
 *  was down; `failures` lists the first `MAX_LISTED_FAILURES` failed pages. */
export interface RunReport {
	readonly seconds: number;
	readonly pages: ReadonlyArray<PageCounts>;
	readonly failures: ReadonlyArray<PageFailure>;
}

const MAX_LISTED_FAILURES = 100;

const OpenRun = Schema.Struct({ id: Schema.BigInt, sourcePart: Schema.String });

export type OpenRun = typeof OpenRun.Type;

const RunId = Schema.Struct({ id: Schema.BigInt });

export class CrawlStore extends Context.Service<
	CrawlStore,
	{
		/** Takes the crawl lock for the scope; `false` when another crawl holds
		 *  it, since two would reset each other's claimed pages. */
		lockCrawl: Effect.Effect<boolean, never, Scope.Scope>;
		/** Opens one run per year with its first page queued, all or none, so a
		 *  crash cannot leave some years open and the others never started. */
		startRuns(
			runs: ReadonlyArray<{ sourcePart: string; first: QueuedPage }>,
		): Effect.Effect<ReadonlyArray<OpenRun>>;
		/** The runs a crash left open, oldest first, with the pages they had
		 *  claimed back in the queue. */
		openRuns: Effect.Effect<ReadonlyArray<OpenRun>>;
		/** The next pending page of the run, claimed so another worker skips it. */
		claim(runId: bigint): Effect.Effect<ClaimedPage | undefined>;
		/** Marks the page done, stores its snapshot when the content hash differs
		 *  from the path's latest one, and queues the pages it links to. */
		complete(
			runId: bigint,
			page: ClaimedPage,
			snapshot: Snapshot,
			next: ReadonlyArray<QueuedPage>,
		): Effect.Effect<void>;
		fail(page: ClaimedPage, error: string): Effect.Effect<void>;
		/** Puts the run's pages that failed once with one of `errors` back in the
		 *  queue, and returns how many. */
		requeue(
			runId: bigint,
			errors: ReadonlyArray<string>,
		): Effect.Effect<number>;
		report(runId: bigint): Effect.Effect<RunReport>;
		finishRun(
			runId: bigint,
			status: "succeeded" | "failed",
			report: RunReport,
		): Effect.Effect<void>;
	}
>()("ukma-data/crawl/CrawlStore") {
	static readonly layer = Layer.effect(
		CrawlStore,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;

			const lockCrawl = sessionLock(CRAWL_LOCK).pipe(
				Effect.provideService(SqlClient.SqlClient, sql),
			);

			const insertRun = SqlSchema.findOne({
				Request: Schema.String,
				Result: RunId,
				execute: (sourcePart) =>
					sql`INSERT INTO runs (source_part) VALUES (${sourcePart}) RETURNING id`,
			});

			const queue = (runId: bigint, pages: ReadonlyArray<QueuedPage>) =>
				pages.length === 0
					? Effect.void
					: sql`
							INSERT INTO run_pages ${sql.insert(
								pages.map((page) => ({
									run_id: runId,
									kind: page.kind,
									path: page.path,
								})),
							)}
							ON CONFLICT (run_id, path) DO NOTHING
						`.pipe(Effect.asVoid);

			const startRuns = (
				runs: ReadonlyArray<{ sourcePart: string; first: QueuedPage }>,
			) =>
				Effect.forEach(runs, ({ sourcePart, first }) =>
					insertRun(sourcePart).pipe(
						Effect.tap(({ id }) => queue(id, [first])),
						Effect.map(({ id }) => ({ id, sourcePart })),
					),
				).pipe(sql.withTransaction, Effect.orDie);

			const findOpenRuns = SqlSchema.findAll({
				Request: Schema.Void,
				Result: OpenRun,
				execute: () => sql`
					SELECT id, source_part AS "sourcePart" FROM runs
					WHERE status = 'running'
					ORDER BY id
				`,
			});

			// A claim the crash cut short gives back its attempt, so the page keeps
			// its one requeue.
			const openRuns = sql`
				UPDATE run_pages SET status = 'pending', attempts = attempts - 1
				WHERE status = 'claimed'
					AND run_id IN (SELECT id FROM runs WHERE status = 'running')
			`.pipe(Effect.andThen(findOpenRuns()), sql.withTransaction, Effect.orDie);

			const claimNext = SqlSchema.findOneOption({
				Request: Schema.BigInt,
				Result: ClaimedPage,
				execute: (runId) => sql`
					UPDATE run_pages
					SET status = 'claimed', claimed_at = coalesce(claimed_at, now()), attempts = attempts + 1
					WHERE id = (
						SELECT id FROM run_pages
						WHERE run_id = ${runId} AND status = 'pending'
						ORDER BY id
						LIMIT 1
						FOR UPDATE SKIP LOCKED
					)
					RETURNING id, kind, path
				`,
			});

			const claim = (runId: bigint) =>
				claimNext(runId).pipe(Effect.map(Option.getOrUndefined), Effect.orDie);

			const latestSnapshot = SqlSchema.findOneOption({
				Request: Schema.String,
				Result: Schema.Struct({
					id: Schema.BigInt,
					content_hash: Schema.String,
				}),
				execute: (path) => sql`
					SELECT id, content_hash FROM page_snapshots
					WHERE path = ${path}
					ORDER BY id DESC
					LIMIT 1
				`,
			});

			const insertSnapshot = SqlSchema.findOne({
				Request: Schema.Struct({
					runId: Schema.BigInt,
					path: Schema.String,
					kind: PageKind,
					hash: Schema.String,
					content: Schema.String,
				}),
				Result: RunId,
				execute: (row) => sql`
					INSERT INTO page_snapshots (path, kind, content_hash, content, run_id)
					VALUES (${row.path}, ${row.kind}, ${row.hash}, ${row.content}, ${row.runId})
					RETURNING id
				`,
			});

			const complete = (
				runId: bigint,
				page: ClaimedPage,
				snapshot: Snapshot,
				next: ReadonlyArray<QueuedPage>,
			) =>
				Effect.gen(function* () {
					const latest = yield* latestSnapshot(page.path);

					const snapshotId =
						Option.isSome(latest) && latest.value.content_hash === snapshot.hash
							? latest.value.id
							: (yield* insertSnapshot({
									runId,
									path: page.path,
									kind: page.kind,
									hash: snapshot.hash,
									content: snapshot.content,
								})).id;

					yield* sql`
						UPDATE run_pages
						SET status = 'done', snapshot_id = ${snapshotId}, error = NULL, finished_at = now()
						WHERE id = ${page.id}
					`;
					yield* queue(runId, next);
				}).pipe(sql.withTransaction, Effect.orDie);

			const fail = (page: ClaimedPage, error: string) =>
				sql`
					UPDATE run_pages SET status = 'failed', error = ${error}, finished_at = now()
					WHERE id = ${page.id}
				`.pipe(Effect.asVoid, Effect.orDie);

			const requeue = (runId: bigint, errors: ReadonlyArray<string>) =>
				sql`
					UPDATE run_pages SET status = 'pending', error = NULL, finished_at = NULL
					WHERE run_id = ${runId} AND status = 'failed' AND error IN ${sql.in(errors)} AND attempts = 1
					RETURNING id
				`.pipe(
					Effect.map((rows) => rows.length),
					Effect.orDie,
				);

			const pageCountsOf = SqlSchema.findAll({
				Request: Schema.BigInt,
				Result: PageCounts,
				execute: (runId) => sql`
					SELECT p.kind,
						count(*) FILTER (WHERE p.status = 'done')::int AS done,
						count(*) FILTER (WHERE p.status = 'failed')::int AS failed,
						count(s.id)::int AS stored
					FROM run_pages p
					LEFT JOIN page_snapshots s ON s.id = p.snapshot_id AND s.run_id = p.run_id
					WHERE p.run_id = ${runId}
					GROUP BY p.kind
					ORDER BY p.kind
				`,
			});

			const failuresOf = SqlSchema.findAll({
				Request: Schema.BigInt,
				Result: PageFailure,
				execute: (runId) => sql`
					SELECT path, error FROM run_pages
					WHERE run_id = ${runId} AND status = 'failed'
					ORDER BY id
					LIMIT ${MAX_LISTED_FAILURES}
				`,
			});

			const secondsOf = SqlSchema.findOne({
				Request: Schema.BigInt,
				Result: Schema.Struct({ seconds: Schema.Number }),
				execute: (runId) => sql`
					SELECT coalesce(extract(epoch FROM now() - min(claimed_at)), 0)::int AS seconds
					FROM run_pages
					WHERE run_id = ${runId}
				`,
			});

			const report = (runId: bigint) =>
				Effect.all({
					seconds: secondsOf(runId).pipe(Effect.map(({ seconds }) => seconds)),
					pages: pageCountsOf(runId),
					failures: failuresOf(runId),
				}).pipe(Effect.orDie);

			const finishRun = (
				runId: bigint,
				status: "succeeded" | "failed",
				report: RunReport,
			) =>
				sql`
					UPDATE runs
					SET status = ${status}, finished_at = now(), report = ${JSON.stringify(report)}::jsonb
					WHERE id = ${runId}
				`.pipe(Effect.asVoid, Effect.orDie);

			return CrawlStore.of({
				lockCrawl,
				startRuns,
				openRuns,
				claim,
				complete,
				fail,
				requeue,
				report,
				finishRun,
			});
		}),
	);
}
