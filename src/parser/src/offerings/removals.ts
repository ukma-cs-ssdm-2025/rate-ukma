import { Config, Effect, Schema } from "effect";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { academicYearOf } from "../crawl/crawl.ts";
import { RemovalStore, type RemovalSurvey } from "./RemovalStore.ts";

/** The share of a year's live offerings one run may remove before its
 *  removals are held for staff. */
export const RemovalThreshold = Config.schema(
	Schema.NumberFromString.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
	"REMOVAL_THRESHOLD",
).pipe(Config.withDefault(0.05));

export type RemovalPlan =
	| { readonly decision: "skipped"; readonly reason: string }
	| {
			readonly decision: "applied" | "held";
			readonly ids: ReadonlyArray<string>;
	  };

/** A run that missed a catalog or course page removes nothing. Nor does a run
 *  whose catalog changed while it read the pages: a course that leaves shifts
 *  the cards after it back, so one moves onto a page already read and the run
 *  never sees it; one that arrives pushes a card onto a page past the last.
 *  Either shows as a later page's total or the codes the run saw differing
 *  from page 1's total. One course leaving and another arriving in the same
 *  run still pass; the next run restores what that removed. Above the
 *  threshold the run removes nothing either and holds the removals as a review
 *  case; its new and changed rows are already published. */
export const planRemovals = (
	survey: RemovalSurvey,
	threshold: number,
): RemovalPlan => {
	if (!survey.complete) {
		return {
			decision: "skipped",
			reason:
				survey.missingPages > 0
					? `run missed ${survey.missingPages} pages`
					: "run did not succeed",
		};
	}

	if (survey.listed === undefined) {
		return { decision: "skipped", reason: "run stored no catalog page 1" };
	}

	const changed = survey.laterTotals.filter((total) => total !== survey.listed);

	if (changed.length > 0) {
		return {
			decision: "skipped",
			reason: `catalog total changed during the run: page 1 listed ${survey.listed}, a later page ${changed[0] ?? "none"}`,
		};
	}

	if (survey.listed !== survey.seen) {
		return {
			decision: "skipped",
			reason: `catalog page 1 listed ${survey.listed} courses, the run saw ${survey.seen}`,
		};
	}

	const ids = survey.candidates;

	return ids.length > Math.floor(threshold * survey.live)
		? { decision: "held", ids }
		: { decision: "applied", ids };
};

/** Decides the offering removals of the latest finished run of each source
 *  part, once per run (spec rule 6, per list). Removals are per list: the
 *  offerings of a year here; the enrollments of one offering (#766) are
 *  replaced in their own write, and only when that offering's students page
 *  is `done` in the run, so a failed students page keeps the last good list. */
export const removeOfferings = Effect.fn("removeOfferings")(function* (
	threshold: number,
) {
	const store = yield* RemovalStore;
	const changes = yield* ChangeLog;

	const decide = Effect.gen(function* () {
		const decided = [];

		for (const run of yield* store.undecidedRuns) {
			const year = academicYearOf(run.sourcePart);

			if (year === undefined) {
				yield* Effect.logWarning("Run has no academic year", {
					run_id: String(run.id),
					source_part: run.sourcePart,
				});
				yield* store.skip(run.id, "run has no academic year");
				continue;
			}

			const survey = yield* store.survey(run.id, year);
			const plan = planRemovals(survey, threshold);

			let removed = 0;

			if (plan.decision === "skipped") {
				yield* store.skip(run.id, plan.reason);
				yield* Effect.logWarning("Run removes nothing", {
					run_id: String(run.id),
					source_part: run.sourcePart,
					reason: plan.reason,
				});
			} else if (plan.decision === "applied") {
				removed = yield* store.apply(run.id, year, plan.ids);
			} else {
				yield* store.hold(run.id, year, plan.ids);
			}

			decided.push({
				run_id: String(run.id),
				source_part: run.sourcePart,
				decision: plan.decision,
				live: survey.live,
				candidates: survey.candidates.length,
				removed,
			});
		}

		return decided;
	});

	const decided = yield* changes.withTurn(decide).pipe(Effect.orDie);

	if (decided.length > 0) {
		yield* Effect.logInfo("Offering removals decided", decided);
	}

	return decided;
});
