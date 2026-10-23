import { describe, expect, it } from "vitest";

import {
	buildPlanYears,
	currentAcademicYearStart,
	semesterKey,
	studyYearOf,
} from "./planTimeline";
import type { PlanCourse } from "./planTypes";

function course(courseId: string, overrides?: Partial<PlanCourse>): PlanCourse {
	return {
		courseId,
		title: `Курс ${courseId}`,
		kind: "PROF_ORIENTED",
		facultyName: null,
		credits: 4,
		weeklyHours: 3,
		...overrides,
	};
}

describe("currentAcademicYearStart", () => {
	it("switches to the new academic year in September", () => {
		expect(currentAcademicYearStart(new Date(2026, 7, 31))).toBe(2025);
		expect(currentAcademicYearStart(new Date(2026, 8, 1))).toBe(2026);
	});
});

describe("studyYearOf", () => {
	it("counts spring and summer into the academic year that began in the fall", () => {
		expect(studyYearOf(2025, 2025, "FALL")).toBe(1);
		expect(studyYearOf(2025, 2026, "SPRING")).toBe(1);
		expect(studyYearOf(2025, 2026, "SUMMER")).toBe(1);
		expect(studyYearOf(2025, 2026, "FALL")).toBe(2);
	});
});

describe("buildPlanYears", () => {
	const taken = {
		[semesterKey({ studyYear: 1, term: "FALL" })]: {
			main: [course("a")],
			backup: [],
		},
	};
	const planned = {
		[semesterKey({ studyYear: 1, term: "FALL" })]: {
			main: [course("ignored")],
			backup: [],
		},
		[semesterKey({ studyYear: 3, term: "SPRING" })]: {
			main: [course("b")],
			backup: [course("c")],
		},
	};

	const years = buildPlanYears({
		enrollmentYearStart: 2025,
		currentYearStart: 2026,
		taken,
		planned,
	});

	it("lays out four study years with their academic years and status", () => {
		expect(
			years.map((year) => [
				year.studyYear,
				year.academicYearStart,
				year.status,
			]),
		).toEqual([
			[1, 2025, "done"],
			[2, 2026, "current"],
			[3, 2027, "planned"],
			[4, 2028, "planned"],
		]);
	});

	it("reads САЗ for past years and the student's picks for planned ones", () => {
		expect(years[0]?.semesters[0]?.main.map((c) => c.courseId)).toEqual(["a"]);
		expect(years[2]?.semesters[1]?.main.map((c) => c.courseId)).toEqual(["b"]);
		expect(years[2]?.semesters[1]?.backup.map((c) => c.courseId)).toEqual([
			"c",
		]);
	});

	it("adds the student's picks to the current year after what САЗ lists", () => {
		const current = buildPlanYears({
			enrollmentYearStart: 2025,
			currentYearStart: 2026,
			taken: {
				"2-FALL": { main: [course("taken", { locked: true })], backup: [] },
			},
			planned: {
				"2-FALL": {
					main: [course("taken"), course("picked")],
					backup: [course("spare")],
				},
			},
		})[1]?.semesters[0];
		expect(current?.main.map((c) => [c.courseId, c.locked ?? false])).toEqual([
			["taken", true],
			["picked", false],
		]);
		expect(current?.backup.map((c) => c.courseId)).toEqual(["spare"]);
	});

	it("has no summer semester in the final year", () => {
		expect(years[3]?.semesters.map((s) => s.unavailable)).toEqual([
			false,
			false,
			true,
		]);
		expect(years[2]?.semesters[2]?.unavailable).toBe(false);
	});

	it("grows past four years when САЗ has a fifth", () => {
		const longer = buildPlanYears({
			enrollmentYearStart: 2021,
			currentYearStart: 2026,
			taken: {
				[semesterKey({ studyYear: 5, term: "FALL" })]: {
					main: [course("x")],
					backup: [],
				},
			},
			planned: {},
		});
		expect(longer).toHaveLength(5);
		expect(longer[3]?.semesters[2]?.unavailable).toBe(false);
	});
});
