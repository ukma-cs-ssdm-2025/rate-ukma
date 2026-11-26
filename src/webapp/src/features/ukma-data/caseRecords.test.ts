import { describe, expect, it } from "vitest";

import type { UkmaDataRecord, UkmaDataReviewCase } from "@/lib/api/generated";
import { recordsSummary, recordTitle, titleRepeats } from "./caseRecords";

const record = (
	id: string,
	title: string,
	place: string,
	ratings = 0,
): UkmaDataRecord => ({
	id,
	kind: "offering",
	title,
	place,
	semester: "Осінь 2030",
	ratings,
	course_id: null,
	on_site: true,
});

const removals = (count: number): UkmaDataReviewCase => ({
	id: "rc-1",
	kind: "removals_held",
	subject_id: "2030",
	candidates: {
		academicYear: 2030,
		offerings: Array.from({ length: count }, (_, index) => `ud-${index}`),
	},
	safe_answer: null,
	status: "open",
	run_id: null,
	decision_id: null,
	opened_at: "2030-09-01T08:00:00Z",
	change_no: 1,
});

describe("caseRecords", () => {
	it("speaks only of the shown semesters when the list is cut", () => {
		const { lines } = recordsSummary(removals(250), [
			record("ud-0", "Тестова дисципліна", "Кафедра прикладів", 3),
		]);

		expect(lines[0]).toBe(
			"250 семестрів навчального року 2030–2031, серед перших 1 оцінки є на 1.",
		);
	});

	it("adds the department only where titles repeat", () => {
		const records = [
			record("a", "Тестова дисципліна", "Кафедра А"),
			record("b", "Тестова дисципліна", "Кафедра Б"),
		];

		expect(titleRepeats(records, ["a", "b"])).toBe(true);
		expect(recordTitle(records, "b", true)).toBe(
			"«Тестова дисципліна» (Кафедра Б)",
		);
	});
});
