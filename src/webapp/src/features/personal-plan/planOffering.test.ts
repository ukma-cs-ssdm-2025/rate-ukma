import { describe, expect, it } from "vitest";

import type { CourseOffering } from "@/lib/api/generated";
import { courseKindFor, offeringForTerm, offeringLoad } from "./planOffering";

function offering(overrides: Partial<CourseOffering>): CourseOffering {
	return { id: "o", course_id: "c", ...overrides } as CourseOffering;
}

describe("offeringLoad", () => {
	const twoTerms = offering({
		terms: [
			{ semester_term: "FALL", credits: "4.0", weekly_hours: 3 },
			{ semester_term: "SPRING", credits: "2.5", weekly_hours: 2 },
		],
	});

	it("reads the load of the matching term", () => {
		expect(offeringLoad(twoTerms, "SPRING")).toEqual({
			credits: 2.5,
			weeklyHours: 2,
		});
	});

	it("falls back to the first term", () => {
		expect(offeringLoad(twoTerms, "SUMMER")).toEqual({
			credits: 4,
			weeklyHours: 3,
		});
	});

	it("is unknown without an offering", () => {
		expect(offeringLoad(undefined, "FALL")).toEqual({
			credits: null,
			weeklyHours: null,
		});
	});
});

describe("offeringForTerm", () => {
	const oldFall = offering({
		id: "old-fall",
		semester_year: 2024,
		semester_term: "FALL",
	});
	const newSpring = offering({
		id: "new-spring",
		semester_year: 2026,
		semester_term: "SPRING",
	});

	it("prefers an offering that runs in the term", () => {
		expect(offeringForTerm([oldFall, newSpring], "FALL")?.id).toBe("old-fall");
	});

	it("falls back to the newest offering", () => {
		expect(offeringForTerm([oldFall, newSpring], "SUMMER")?.id).toBe(
			"new-spring",
		);
	});
});

describe("courseKindFor", () => {
	const specialities = [
		{ speciality_id: "se", type_kind: "PROF_ORIENTED" as const },
		{ speciality_id: "cs", type_kind: "COMPULSORY" as const },
	];

	it("uses the student's own speciality", () => {
		expect(courseKindFor(specialities, "cs")).toBe("COMPULSORY");
	});

	it("treats a course from another speciality as free choice", () => {
		expect(courseKindFor(specialities, "law")).toBe("ELECTIVE");
		expect(courseKindFor(undefined, "se")).toBe("ELECTIVE");
	});
});
