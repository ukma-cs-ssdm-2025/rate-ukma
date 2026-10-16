import { assert, describe, it } from "@effect/vitest";
import { planRemovals } from "./removals.ts";

const ids = (count: number) =>
	Array.from({ length: count }, (_, index) => `off_${index}`);

describe("planRemovals", () => {
	it("applies removals up to the threshold and holds one more", () => {
		// 5% of 3,250 offerings is 162.5, so the limit is 162.
		assert.deepStrictEqual(
			planRemovals({ complete: true, live: 3250, candidates: ids(162) }, 0.05),
			{ decision: "applied", ids: ids(162) },
		);
		assert.deepStrictEqual(
			planRemovals({ complete: true, live: 3250, candidates: ids(163) }, 0.05),
			{ decision: "held", ids: ids(163) },
		);
	});

	it("skips a run that missed a catalog or course page", () => {
		assert.deepStrictEqual(
			planRemovals({ complete: false, live: 3250, candidates: ids(1) }, 0.05),
			{ decision: "skipped" },
		);
	});

	it("applies an empty removal, which closes an earlier held case", () => {
		assert.deepStrictEqual(
			planRemovals({ complete: true, live: 0, candidates: [] }, 0.05),
			{ decision: "applied", ids: [] },
		);
	});
});
