import { describe, expect, it } from "vitest";

import {
	creditsToHours,
	getPlanSummary,
	getYearCredits,
	getYearLoadStatus,
} from "./studyPlanRules";
import type { PlanCourse, PlanYear } from "./studyPlanTypes";

function course(
	id: string,
	credits: number,
	category: PlanCourse["category"],
): PlanCourse {
	return { id, title: id, credits, category };
}

function year(courses: PlanCourse[], backups: PlanCourse[] = []): PlanYear {
	return {
		key: "y",
		courseNumber: 1,
		academicYear: "2025–2026",
		status: "planned",
		semesters: [{ key: "s", season: "FALL", courses, backups }],
	};
}

describe("studyPlanRules", () => {
	it("converts credits to hours", () => {
		expect(creditsToHours(4)).toBe(120);
	});

	it("ignores backup courses in year credits", () => {
		const plan = year(
			[course("a", 5, "COMPULSORY")],
			[course("b", 4, "ELECTIVE")],
		);
		expect(getYearCredits(plan)).toBe(5);
	});

	it.each([
		[57, { kind: "under", missing: 1 }],
		[58, { kind: "ok" }],
		[62, { kind: "ok" }],
		[64, { kind: "over", excess: 2 }],
	])("classifies yearly load of %i credits", (credits, expected) => {
		expect(getYearLoadStatus(credits)).toEqual(expected);
	});

	it("computes remaining credits and category limits", () => {
		const summary = getPlanSummary([
			year([
				course("a", 150, "COMPULSORY"),
				course("b", 20, "PROF_ORIENTED"),
				course("c", 27, "ELECTIVE"),
			]),
		]);

		expect(summary.totalCredits).toBe(197);
		expect(summary.remainingCredits).toBe(43);
		expect(summary.profOrientedMissing).toBe(34);
		expect(summary.electiveAvailable).toBe(0);
		expect(summary.electiveExcess).toBe(2);
	});
});
