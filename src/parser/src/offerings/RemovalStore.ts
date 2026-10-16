import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { ChangeLog } from "../changes/ChangeLog.ts";

const UndecidedRun = Schema.Struct({
	id: Schema.BigInt,
	sourcePart: Schema.String,
});

export type UndecidedRun = typeof UndecidedRun.Type;

export interface RemovalSurvey {
	/** Every catalog and course page of the run loaded. */
	readonly complete: boolean;
	/** The year's offerings that are not removed. */
	readonly live: number;
	/** The year's live offerings that no course page of the run lists. */
	readonly candidates: ReadonlyArray<string>;
}

const Survey = Schema.Struct({
	complete: Schema.Boolean,
	live: Schema.BigInt,
	candidates: Schema.Array(Schema.String),
});

/** Every method but `undecidedRuns` writes numbered rows, so it runs inside
 *  `ChangeLog.withTurn`. */
export class RemovalStore extends Context.Service<
	RemovalStore,
	{
		/** The latest run of each source part, when it finished and its
		 *  removals are not decided yet. An older run is never decided, so it
		 *  cannot remove what a newer run lists. */
		undecidedRuns: Effect.Effect<ReadonlyArray<UndecidedRun>>;
		survey(runId: bigint, academicYear: number): Effect.Effect<RemovalSurvey>;
		/** Removes the offerings, closes the year's open held removals and
		 *  returns how many rows it removed. */
		apply(
			runId: bigint,
			academicYear: number,
			ids: ReadonlyArray<string>,
		): Effect.Effect<number>;
		/** Opens a `removals_held` review case in place of the year's open one. */
		hold(
			runId: bigint,
			academicYear: number,
			ids: ReadonlyArray<string>,
		): Effect.Effect<void>;
		skip(runId: bigint): Effect.Effect<void>;
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
						r.status = 'succeeded' AND NOT EXISTS (
							SELECT 1 FROM run_pages p
							WHERE p.run_id = r.id AND p.kind IN ('catalog', 'course')
								AND p.status <> 'done'
						) AS complete,
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
					Effect.map(({ complete, live, candidates }) => ({
						complete,
						live: Number(live),
						candidates,
					})),
					Effect.orDie,
				);

			const decide = (
				runId: bigint,
				decision: "applied" | "held" | "skipped",
			) =>
				sql`UPDATE runs SET offering_removals = ${decision} WHERE id = ${runId}`.pipe(
					Effect.asVoid,
					Effect.orDie,
				);

			const closeHeld = (runId: bigint, year: number) =>
				changes.track(
					"review_cases",
					{ runId },
					sql`
						UPDATE review_cases
						SET status = 'obsolete', change_no = nextval('change_no_seq')
						WHERE kind = 'removals_held' AND status = 'open'
							AND (candidates ->> 'academicYear')::int = ${year}
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
					yield* closeHeld(runId, year);
					yield* changes.track(
						"review_cases",
						{ runId },
						sql`
							INSERT INTO review_cases (
								kind, subject_id, candidates, safe_answer, run_id, change_no
							)
							VALUES (
								'removals_held', ${`run_${runId}`},
								jsonb_build_object(
									'academicYear', ${year}::int,
									'offeringIds', ${JSON.stringify(ids)}::jsonb
								),
								'{"removals": "held"}', ${runId}, nextval('change_no_seq')
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
				skip: (runId) => decide(runId, "skipped"),
			});
		}),
	);
}
