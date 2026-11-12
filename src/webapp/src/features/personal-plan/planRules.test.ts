import { describe, expect, it } from "vitest";

import type { PlanCourse, PlanYear, TypeKindEnum } from "@/lib/api/generated";
import { summarizePlan, yearCredits } from "./planRules";

function course(kind: TypeKindEnum, credits: string | undefined): PlanCourse {
	return {
		course_id: `${kind}-${credits}`,
		title: kind,
		type_kind: kind,
		faculty_name: "ФІ",
		credits,
		weekly_hours: 2,
		is_mandatory: false,
	};
}

const year: PlanYear = {
	study_year: 3,
	academic_year_start: 2027,
	year_status: "planned",
	semesters: [
		{
			semester_term: "FALL",
			main: [course("COMPULSORY", "5.0"), course("PROF_ORIENTED", "4.5")],
			backup: [course("PROF_ORIENTED", "6.0")],
			is_graduation_summer: false,
		},
		{
			semester_term: "SPRING",
			main: [course("ELECTIVE", "3.0"), course("ELECTIVE", undefined)],
			backup: [course("ELECTIVE", "3.0")],
			is_graduation_summer: false,
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
