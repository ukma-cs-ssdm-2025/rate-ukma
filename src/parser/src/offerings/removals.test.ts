import { assert, describe, it } from "@effect/vitest";
import type { RemovalSurvey } from "./RemovalStore.ts";
import { planRemovals } from "./removals.ts";

const ids = (count: number) =>
	Array.from({ length: count }, (_, index) => `off_${index}`);

/** A complete run that saw every course page 1 listed. */
const survey = (patch: Partial<RemovalSurvey>): RemovalSurvey => ({
	complete: true,
	missingPages: 0,
	listed: 3250,
	seen: 3250,
	live: 3250,
	candidates: [],
	...patch,
});

describe("planRemovals", () => {
	it("applies removals up to the threshold and holds one more", () => {
		// 5% of 3,250 offerings is 162.5, so the limit is 162.
		assert.deepStrictEqual(
			planRemovals(survey({ candidates: ids(162) }), 0.05),
			{ decision: "applied", ids: ids(162) },
		);
		assert.deepStrictEqual(
			planRemovals(survey({ candidates: ids(163) }), 0.05),
			{ decision: "held", ids: ids(163) },
		);
	});

	it("skips a run that missed a catalog or course page", () => {
		assert.deepStrictEqual(
			planRemovals(
				survey({ complete: false, missingPages: 1, candidates: ids(1) }),
				0.05,
			),
			{ decision: "skipped", reason: "run missed 1 pages" },
		);
	});

	it("skips a run that saw fewer courses than page 1 listed", () => {
		assert.deepStrictEqual(
			planRemovals(survey({ seen: 3249, candidates: ids(1) }), 0.05),
			{
				decision: "skipped",
				reason: "catalog page 1 listed 3250 courses, the run saw 3249",
			},
		);
		assert.deepStrictEqual(
			planRemovals(survey({ listed: undefined, candidates: ids(1) }), 0.05),
			{
				decision: "skipped",
				reason: "run stored no catalog page 1",
			},
		);
	});

	it("applies an empty removal, which closes an earlier held case", () => {
		assert.deepStrictEqual(
			planRemovals(survey({ listed: 0, seen: 0, live: 0 }), 0.05),
			{ decision: "applied", ids: [] },
		);
	});
});
