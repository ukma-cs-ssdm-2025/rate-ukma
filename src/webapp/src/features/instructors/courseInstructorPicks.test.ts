import { describe, expect, it } from "vitest";

import type { CourseInstructorMentions } from "@/lib/api/generated";
import { pickCourseInstructors } from "./courseInstructorPicks";

function mention(
	id: string,
	ratings_count: number,
	offering_ratings_count = 0,
	planned = false,
): CourseInstructorMentions {
	return {
		instructor: { id, first_name: "Ім'я", last_name: id },
		ratings_count,
		offering_ratings_count,
		students_count: ratings_count,
		recent_students_count: ratings_count,
		planned,
	};
}

const ids = (items: CourseInstructorMentions[]) =>
	items.map((item) => item.instructor.id);

describe("pickCourseInstructors", () => {
	it("keeps one mention on this offering", () => {
		expect(ids(pickCourseInstructors([mention("a", 1, 1)], []))).toEqual(["a"]);
	});

	it("needs two mentions on the course without this offering", () => {
		expect(
			ids(pickCourseInstructors([mention("a", 2), mention("b", 1)], [])),
		).toEqual(["a"]);
	});

	it("offers at most two, in the order given", () => {
		const items = [mention("a", 5, 2), mention("b", 4), mention("c", 3)];
		expect(ids(pickCourseInstructors(items, []))).toEqual(["a", "b"]);
	});

	it("skips teachers already chosen and moves the next one up", () => {
		const items = [mention("a", 5, 2), mention("b", 4), mention("c", 3)];
		expect(ids(pickCourseInstructors(items, ["a"]))).toEqual(["b", "c"]);
	});

	it("offers nothing when nobody named anyone", () => {
		expect(pickCourseInstructors([], [])).toEqual([]);
	});

	it("adds teachers planned for the offering after students' picks", () => {
		const items = [
			mention("a", 5, 2),
			mention("b", 4, 0, true),
			mention("c", 3),
			mention("d", 0, 0, true),
			mention("e", 0, 0, true),
		];
		expect(ids(pickCourseInstructors(items, []))).toEqual(["a", "b", "d"]);
	});

	it("offers planned teachers alone when nobody was named", () => {
		const items = [mention("a", 0, 0, true), mention("b", 1)];
		expect(ids(pickCourseInstructors(items, ["x"]))).toEqual(["a"]);
	});
});
