import { describe, expect, it } from "vitest";

import { applyDecision } from "./api/mockClient";
import { MOCK_CASES, MOCK_DECISIONS } from "./api/mockData";
import { reviewCase as reviewCaseSchema } from "./api/schemas";
import { availableDecisions } from "./reviewCases";

const byId = (id: string) => {
	const found = MOCK_CASES.find((item) => item.id === id);
	if (!found) throw new Error(id);
	return found;
};
const state = { cases: MOCK_CASES, decisions: MOCK_DECISIONS, changeNo: 100 };

describe("availableDecisions", () => {
	it("offers each open kind its own pair", () => {
		expect(availableDecisions(byId("rev_01"), undefined)).toEqual([
			"merge",
			"keep_apart",
		]);
		expect(availableDecisions(byId("rev_03"), undefined)).toEqual([
			"link_instructor",
			"keep_unlinked",
		]);
		expect(availableDecisions(byId("rev_04"), undefined)).toEqual([
			"apply_removals",
			"drop_removals",
		]);
	});

	it("offers a split only after a merge", () => {
		const merged = byId("rev_06");
		expect(availableDecisions(merged, MOCK_DECISIONS[1])).toEqual(["split"]);
		expect(availableDecisions(byId("rev_07"), MOCK_DECISIONS[0])).toEqual([]);
		expect(availableDecisions(byId("rev_08"), undefined)).toEqual([]);
	});
});

describe("applyDecision", () => {
	it("moves the offering to the candidate course on merge", () => {
		const next = applyDecision(
			state,
			{ kind: "merge", reviewCaseId: "rev_01" },
			"2026-10-17T10:00:00Z",
		);
		const decided = next.cases.find((item) => item.id === "rev_01");
		expect(decided).toMatchObject({
			status: "decided",
			decisionId: "dec_101",
			subject: { courseId: "crs_112" },
		});
		expect(next.decisions[0]).toMatchObject({ changeNo: 101, kind: "merge" });
		expect(next.decisions[0].rows).toHaveLength(2);
	});

	it("lists every held offering when removals are applied", () => {
		const next = applyDecision(
			state,
			{ kind: "apply_removals", reviewCaseId: "rev_04" },
			"2026-10-17T10:00:00Z",
		);
		expect(next.decisions[0].rows).toHaveLength(214);
	});

	it("keeps the fixtures valid against the API schema", () => {
		for (const item of MOCK_CASES) {
			expect(() => reviewCaseSchema.parse(item)).not.toThrow();
		}
	});
});
