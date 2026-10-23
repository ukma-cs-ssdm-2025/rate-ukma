import { describe, expect, it } from "vitest";

import { summarizePlan, yearCredits } from "./planRules";
import type { PlanCourse, PlanYear } from "./planTypes";

function course(kind: PlanCourse["kind"], credits: number | null): PlanCourse {
	return {
		courseId: `${kind}-${credits}`,
		title: kind,
		kind,
		facultyName: null,
		credits,
		weeklyHours: 2,
	};
}

const year: PlanYear = {
	studyYear: 3,
	academicYearStart: 2027,
	status: "planned",
	semesters: [
		{
			term: "FALL",
			main: [course("COMPULSORY", 5), course("PROF_ORIENTED", 4.5)],
			backup: [course("PROF_ORIENTED", 6)],
			unavailable: false,
		},
		{
			term: "SPRING",
			main: [course("ELECTIVE", 3), course("ELECTIVE", null)],
			backup: [course("ELECTIVE", 3)],
			unavailable: false,
		},
	],
};

describe("summarizePlan", () => {
	it("totals main courses by kind and leaves backups out", () => {
		expect(summarizePlan([year])).toEqual({
			totalCredits: 12.5,
			compulsoryCredits: 5,
			profOrientedCredits: 4.5,
			electiveCredits: 3,
			backupCount: 2,
		});
	});
});

describe("yearCredits", () => {
	it("sums main credits across the year's semesters", () => {
		expect(yearCredits(year)).toBe(12.5);
	});
});
