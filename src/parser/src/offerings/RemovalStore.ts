import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { ChangeLog, type Turn } from "../changes/ChangeLog.ts";
import { catalogPath, parseCatalogPage } from "../saz/catalog.ts";

const UndecidedRun = Schema.Struct({
	id: Schema.BigInt,
	sourcePart: Schema.String,
});

export type UndecidedRun = typeof UndecidedRun.Type;

export interface RemovalSurvey {
	/** The run succeeded and every catalog and course page of it loaded. */
	readonly complete: boolean;
	/** Catalog and course pages of the run that did not load. */
	readonly missingPages: number;
	/** The course total that page 1 of the run's catalog reported, when the
	 *  run stored that page. */
	readonly listed: number | undefined;
	/** The distinct course codes the run's catalog pages listed. */
	readonly seen: number;
	/** The year's offerings that are not removed. */
	readonly live: number;
	/** The year's live offerings that no course page of the run lists. */
	readonly candidates: ReadonlyArray<string>;
}

const Survey = Schema.Struct({
	succeeded: Schema.Boolean,
	missingPages: Schema.BigInt,
	firstCatalogPage: Schema.NullOr(Schema.String),
	seen: Schema.BigInt,
	live: Schema.BigInt,
	candidates: Schema.Array(Schema.String),
});

/** Every method but `undecidedRuns` needs the writers' turn, so a run's survey
 *  and its decision see the same rows. */
export class RemovalStore extends Context.Service<
	RemovalStore,
	{
		/** The latest run of each source part, when it finished and its
		 *  removals are not decided yet. An older run is never decided, so it
		 *  cannot remove what a newer run lists. */
		undecidedRuns: Effect.Effect<ReadonlyArray<UndecidedRun>>;
		survey(
			runId: bigint,
			academicYear: number,
		): Effect.Effect<RemovalSurvey, never, Turn>;
		/** Removes the offerings, closes the year's open held removals and
		 *  returns how many rows it removed. */
		apply(
			runId: bigint,
			academicYear: number,
			ids: ReadonlyArray<string>,
		): Effect.Effect<number, never, Turn>;
		/** Opens a `removals_held` review case in place of the year's open one,
		 *  or keeps that one when it holds the same offerings. */
		hold(
			runId: bigint,
			academicYear: number,
			ids: ReadonlyArray<string>,
		): Effect.Effect<void, never, Turn>;
		/** Decides that the run removes nothing, and adds why to its report. */
		skip(runId: bigint, reason: string): Effect.Effect<void, never, Turn>;
	}
>()("ukma-data/offerings/RemovalStore") {
	static readonly layer = Layer.effect(
		RemovalStore,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const changes = yield* ChangeLog;

			const findUndecidedRuns = SqlSchema.findAll({
				Request: Schema.Void,
				Result: UndecidedRun,
				execute: () => sql`
					SELECT id, source_part AS "sourcePart" FROM (
						SELECT DISTINCT ON (source_part) id, source_part, status, offering_removals
						FROM runs
						ORDER BY source_part, id DESC
					) latest
					WHERE status <> 'running' AND offering_removals IS NULL
					ORDER BY id
				`,
			});

			const findSurvey = SqlSchema.findOne({
				Request: Schema.Struct({ runId: Schema.BigInt, year: Schema.Number }),
				Result: Survey,
				execute: ({ runId, year }) => sql`
					SELECT
						r.status = 'succeeded' AS succeeded,
						(
							SELECT count(*) FROM run_pages p
							WHERE p.run_id = r.id AND p.kind IN ('catalog', 'course')
								AND p.status <> 'done'
						) AS "missingPages",
						(
							SELECT s.content FROM run_pages p
							JOIN page_snapshots s ON s.id = p.snapshot_id
							WHERE p.run_id = r.id AND p.kind = 'catalog'
								AND p.path = ${catalogPath(year, 1)}
						) AS "firstCatalogPage",
						(
							SELECT count(DISTINCT p.path) FROM run_pages p
							WHERE p.run_id = r.id AND p.kind = 'course'
						) AS seen,
						(
							SELECT count(*) FROM offerings o
							WHERE o.academic_year = ${year} AND o.removed_at IS NULL
						) AS live,
						ARRAY(
							SELECT o.id FROM offerings o
							WHERE o.academic_year = ${year} AND o.removed_at IS NULL
								AND NOT EXISTS (
									SELECT 1 FROM run_pages p
									WHERE p.run_id = r.id AND p.kind = 'course'
										AND p.path = '/course/' || o.saz_code
								)
							ORDER BY o.id
						) AS candidates
					FROM runs r
					WHERE r.id = ${runId}
				`,
			});

			const survey = (runId: bigint, year: number) =>
				findSurvey({ runId, year }).pipe(
					Effect.map(
						({
							succeeded,
							missingPages,
							firstCatalogPage,
							seen,
							live,
							candidates,
						}) => ({
							complete: succeeded && missingPages === 0n,
							missingPages: Number(missingPages),
							listed:
								firstCatalogPage === null
									? undefined
									: parseCatalogPage(firstCatalogPage).shown?.total,
							seen: Number(seen),
							live: Number(live),
							candidates,
						}),
					),
					Effect.orDie,
				);

			const decide = (runId: bigint, decision: "applied" | "held") =>
				sql`UPDATE runs SET offering_removals = ${decision} WHERE id = ${runId}`.pipe(
					Effect.asVoid,
					Effect.orDie,
				);

			const skip = (runId: bigint, reason: string) =>
				sql`
					UPDATE runs SET offering_removals = 'skipped',
						report = coalesce(report, '{}') || jsonb_build_object('removalsSkipped', ${reason}::text)
					WHERE id = ${runId}
				`.pipe(Effect.asVoid, Effect.orDie);

			/** Closes the year's open held removals, except one that holds
			 *  exactly `keep`, so staff keep looking at the same case. */
			const closeHeld = (
				runId: bigint,
				year: number,
				keep: ReadonlyArray<string> = [],
			) =>
				changes.track(
					"review_cases",
					{ runId },
					sql`
						UPDATE review_cases
						SET status = 'obsolete', change_no = nextval('change_no_seq')
						WHERE kind = 'removals_held' AND status = 'open'
							AND (candidates ->> 'academicYear')::int = ${year}
							AND candidates -> 'offeringIds' <> ${JSON.stringify(keep)}::jsonb
						RETURNING id, change_no, 'change' AS action
					`,
				);

			const apply = (runId: bigint, year: number, ids: ReadonlyArray<string>) =>
				Effect.gen(function* () {
					const removed =
						ids.length === 0
							? []
							: yield* changes.track(
									"offerings",
									{ runId },
									sql`
										UPDATE offerings
										SET removed_at = now(), change_no = nextval('change_no_seq')
										WHERE id IN ${sql.in(ids)} AND removed_at IS NULL
										RETURNING id, change_no, 'remove' AS action
									`,
								);

					yield* closeHeld(runId, year);
					yield* decide(runId, "applied");

					return removed.length;
				});

			const hold = (runId: bigint, year: number, ids: ReadonlyArray<string>) =>
				Effect.gen(function* () {
					const candidates = { academicYear: year, offeringIds: ids };

					yield* closeHeld(runId, year, ids);
					yield* changes.track(
						"review_cases",
						{ runId },
						sql`
							INSERT INTO review_cases (
								kind, subject_id, candidates, safe_answer, run_id, change_no
							)
							SELECT 'removals_held', ${`run_${runId}`},
								${JSON.stringify(candidates)}::jsonb,
								'{"removals": "held"}', ${runId}, nextval('change_no_seq')
							WHERE NOT EXISTS (
								SELECT 1 FROM review_cases
								WHERE kind = 'removals_held' AND status = 'open'
									AND candidates = ${JSON.stringify(candidates)}::jsonb
							)
							RETURNING id, change_no, 'add' AS action
						`,
					);
					yield* decide(runId, "held");
				});

			return RemovalStore.of({
				undecidedRuns: findUndecidedRuns().pipe(Effect.orDie),
				survey,
				apply,
				hold,
				skip,
			});
		}),
	);
}
