import { describe, expect, it } from "vitest";

import type { PlanCourse, PlanYear } from "@/lib/api/generated";
import { allCourseIds, findPlannedCourse } from "./planTimeline";

function course(courseId: string, overrides?: Partial<PlanCourse>): PlanCourse {
	return {
		course_id: courseId,
		title: `Курс ${courseId}`,
		type_kind: "PROF_ORIENTED",
		faculty_name: "ФІ",
		credits: "4.0",
		weekly_hours: 3,
		is_mandatory: false,
		...overrides,
	};
}

const years: PlanYear[] = [
	{
		study_year: 1,
		academic_year_start: 2023,
		year_status: "done",
		semesters: [
			{
				semester_term: "FALL",
				main: [course("taken", { is_mandatory: true })],
				backup: [],
				is_graduation_summer: false,
			},
		],
	},
	{
		study_year: 3,
		academic_year_start: 2025,
		year_status: "planned",
		semesters: [
			{
				semester_term: "FALL",
				main: [course("pick"), course("two-terms")],
				backup: [course("spare")],
				is_graduation_summer: false,
			},
			{
				semester_term: "SPRING",
				main: [course("two-terms")],
				backup: [],
				is_graduation_summer: false,
			},
		],
	},
];

describe("findPlannedCourse", () => {
	it("finds the student's pick and its slot", () => {
		expect(findPlannedCourse(years, "spare")).toEqual({
			target: { study_year: 3, semester_term: "FALL" },
			slot: "BACKUP",
			locked: false,
		});
	});

	it("marks a taken or mandatory course as locked", () => {
		expect(findPlannedCourse(years, "taken")).toEqual({
			target: { study_year: 1, semester_term: "FALL" },
			slot: "MAIN",
			locked: true,
		});
	});

	it("answers with the first semester of a multi-semester course", () => {
		expect(findPlannedCourse(years, "two-terms")?.target).toEqual({
			study_year: 3,
			semester_term: "FALL",
		});
	});

	it("returns null for a course outside the plan", () => {
		expect(findPlannedCourse(years, "other")).toBeNull();
	});
});

describe("allCourseIds", () => {
	it("lists a multi-semester course once", () => {
		expect([...allCourseIds(years)].sort()).toEqual([
			"pick",
			"spare",
			"taken",
			"two-terms",
		]);
	});
});
