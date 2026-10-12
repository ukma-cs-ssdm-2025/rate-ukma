import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
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

/** One line of a run report: the pages of one kind and how many of them
 *  stored a new snapshot. */
const KindTally = Schema.Struct({
	kind: PageKind,
	done: Schema.Number,
	failed: Schema.Number,
	stored: Schema.Number,
});

export type KindTally = typeof KindTally.Type;

export interface RunReport {
	readonly sourcePart: string;
	readonly seconds: number;
	readonly pages: ReadonlyArray<KindTally>;
}

const RunId = Schema.Struct({ id: Schema.BigInt });

export class CrawlStore extends Context.Service<
	CrawlStore,
	{
		startRun(sourcePart: string, first: QueuedPage): Effect.Effect<bigint>;
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
		tally(runId: bigint): Effect.Effect<ReadonlyArray<KindTally>>;
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

			const startRun = (sourcePart: string, first: QueuedPage) =>
				sql
					.withTransaction(
						insertRun(sourcePart).pipe(
							Effect.tap(({ id }) => queue(id, [first])),
							Effect.map(({ id }) => id),
						),
					)
					.pipe(Effect.orDie);

			const claimNext = SqlSchema.findOneOption({
				Request: Schema.BigInt,
				Result: ClaimedPage,
				execute: (runId) => sql`
					UPDATE run_pages
					SET status = 'claimed', claimed_at = now(), attempts = attempts + 1
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

			const tallyOf = SqlSchema.findAll({
				Request: Schema.BigInt,
				Result: KindTally,
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

			const tally = (runId: bigint) => tallyOf(runId).pipe(Effect.orDie);

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
				startRun,
				claim,
				complete,
				fail,
				tally,
				finishRun,
			});
		}),
	);
}
