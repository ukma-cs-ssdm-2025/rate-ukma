import { describe, expect, it } from "vitest";

import type {
	SemesterTermEnum,
	StudentRatingsDetailed,
} from "@/lib/api/generated";
import { groupRatingsByYearAndSemester } from "./groupRatings";
import {
	createMockInlineRatingDetailed,
	createMockStudentRating,
} from "@/test-utils/factories";

function makeCourse(
	index: number,
	overrides?: Partial<StudentRatingsDetailed>,
): StudentRatingsDetailed {
	return createMockStudentRating({
		course_id: `course-${index}`,
		course_title: `Курс ${index}`,
		course_code: `9000${index}`,
		course_offering_id: `offering-${index}`,
		...overrides,
	});
}

function ratedCourse(index: number, year: number, season: SemesterTermEnum) {
	return makeCourse(index, {
		semester: { year, season },
		rated: createMockInlineRatingDetailed({
			id: `rating-${index}`,
			difficulty: 4,
			usefulness: 5,
		}),
	});
}

describe("groupRatingsByYearAndSemester", () => {
	it("orders academic years newest first", () => {
		const groups = groupRatingsByYearAndSemester([
			makeCourse(1, { semester: { year: 2024, season: "SPRING" } }),
			makeCourse(2, { semester: { year: 2025, season: "FALL" } }),
		]);

		expect(groups.map((group) => group.label)).toEqual([
			"2025 – 2026",
			"2023 – 2024",
		]);
	});

	it("lists rated and unrated courses together in one semester", () => {
		const groups = groupRatingsByYearAndSemester([
			ratedCourse(1, 2025, "FALL"),
			makeCourse(2, { semester: { year: 2025, season: "FALL" } }),
		]);

		expect(groups).toHaveLength(1);
		const semester = groups[0]?.seasons[0];
		expect(semester?.items).toHaveLength(2);
		expect(semester?.ratedCount).toBe(1);
		expect(semester?.totalCount).toBe(2);
	});
});
