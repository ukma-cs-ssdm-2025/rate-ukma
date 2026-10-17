import { describe, expect, it } from "vitest";

import { applyDecision } from "./mockClient";
import { MOCK_CASES, MOCK_DECISIONS } from "./mockData";
import {
	decision as decisionSchema,
	type OfferingEvidence,
	type ReviewCase,
	reviewCase as reviewCaseSchema,
} from "./schemas";

const MADE_AT = "2026-10-17T10:00:00Z";

const offering = (id: string, courseId: string): OfferingEvidence => ({
	id,
	sazCode: "900001",
	academicYear: 2026,
	title: "Вигаданий курс",
	department: "Вигадана кафедра",
	credits: 4,
	courseId,
});

const base = {
	status: "open",
	openedAt: "2026-10-17T05:00:00Z",
	runId: 1,
	decisionId: null,
} as const;

const CASES: ReviewCase[] = [
	{
		...base,
		id: "rev_match",
		kind: "course_match",
		subject: offering("off_1", "crs_1"),
		candidate: offering("off_2", "crs_2"),
	},
	{
		...base,
		id: "rev_teacher",
		kind: "instructor_match",
		subject: offering("off_3", "crs_3"),
		sazTeacherLine: "Вигаданий В. В.",
		candidates: [],
	},
	{
		...base,
		id: "rev_held",
		kind: "removals_held",
		academicYear: 2026,
		liveOfferings: 40,
		threshold: 0.05,
		offerings: [offering("off_4", "crs_4"), offering("off_5", "crs_5")],
	},
];

const state = { cases: CASES, decisions: [], changeNo: 100 };
const caseIn = (next: { cases: ReviewCase[] }, id: string) =>
	next.cases.find((item) => item.id === id);

describe("applyDecision", () => {
	it("moves the offering to the candidate course on merge", () => {
		const next = applyDecision(
			state,
			{ kind: "merge", reviewCaseId: "rev_match" },
			MADE_AT,
		);

		expect(caseIn(next, "rev_match")).toMatchObject({
			status: "decided",
			decisionId: "dec_101",
			subject: { courseId: "crs_2" },
		});
		expect(next.decisions[0]).toMatchObject({
			id: "dec_101",
			changeNo: 101,
			kind: "merge",
			madeAt: MADE_AT,
		});
		expect(next.decisions[0].rows.map((row) => row.list)).toEqual([
			"offerings",
			"courses",
		]);
	});

	it("gives the offering its own course back on split", () => {
		const merged = applyDecision(
			state,
			{ kind: "merge", reviewCaseId: "rev_match" },
			MADE_AT,
		);
		const next = applyDecision(
			merged,
			{ kind: "split", reviewCaseId: "rev_match", reversesId: "dec_101" },
			MADE_AT,
		);

		expect(caseIn(next, "rev_match")).toMatchObject({
			decisionId: "dec_102",
			subject: { courseId: "crs_900001" },
		});
		expect(next.decisions[0].reversesId).toBe("dec_101");
		expect(next.decisions).toHaveLength(2);
	});

	it("lists every held offering when removals are applied", () => {
		const next = applyDecision(
			state,
			{ kind: "apply_removals", reviewCaseId: "rev_held" },
			MADE_AT,
		);

		expect(next.decisions[0].rows.map((row) => row.id)).toEqual([
			"off_4",
			"off_5",
		]);
	});

	it("links the chosen instructor to the offering", () => {
		const next = applyDecision(
			state,
			{
				kind: "link_instructor",
				reviewCaseId: "rev_teacher",
				instructorId: "ins_9",
			},
			MADE_AT,
		);

		expect(next.decisions[0].rows).toEqual([
			{ list: "instructor_links", id: "ins_9:off_3", change: "додано" },
		]);
	});

	it("leaves other cases and the input state untouched", () => {
		const next = applyDecision(
			state,
			{ kind: "keep_apart", reviewCaseId: "rev_match" },
			MADE_AT,
		);

		expect(caseIn(next, "rev_held")).toBe(CASES[2]);
		expect(state.cases[0].status).toBe("open");
		expect(state.changeNo).toBe(100);
	});

	it("throws for an unknown case", () => {
		expect(() =>
			applyDecision(
				state,
				{ kind: "merge", reviewCaseId: "rev_missing" },
				MADE_AT,
			),
		).toThrow("rev_missing");
	});
});

describe("mock data", () => {
	it("matches the API schema", () => {
		for (const item of MOCK_CASES) {
			expect(() => reviewCaseSchema.parse(item)).not.toThrow();
		}
		for (const item of MOCK_DECISIONS) {
			expect(() => decisionSchema.parse(item)).not.toThrow();
		}
	});
});
