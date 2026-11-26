import { describe, expect, it } from "vitest";

import type {
	PlanCourse,
	PlanYear,
	CourseTypeKindEnum,
} from "@/lib/api/generated";
import { sumCredits, summarizePlan, yearCredits } from "./planRules";

function course(kind: CourseTypeKindEnum, credits: string): PlanCourse {
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
			main: [course("ELECTIVE", "3.0"), course("ELECTIVE", "")],
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

describe("credit sums (US-5.9, US-5.2)", () => {
	it("sums decimal credits exactly: 3.5 and 2.5 make 6", () => {
		expect(
			sumCredits([course("ELECTIVE", "3.5"), course("ELECTIVE", "2.5")]),
		).toBe(6);
	});

	it("counts nothing for a semester whose only course is a backup", () => {
		const onlyBackup: PlanYear = {
			study_year: 3,
			academic_year_start: 2027,
			year_status: "planned",
			semesters: [
				{
					semester_term: "SPRING",
					main: [],
					backup: [course("ELECTIVE", "4.0")],
					is_graduation_summer: false,
				},
			],
		};

		expect(yearCredits(onlyBackup)).toBe(0);
		expect(summarizePlan([onlyBackup])).toMatchObject({
			totalCredits: 0,
			electiveCredits: 0,
			backupCount: 1,
		});
	});
});
