import { describe, expect, it } from "vitest";

import type { CourseInstructorMentions } from "@/lib/api/generated";
import { chosenByNote, namedCourseTeachers } from "./courseTeachers";

const mention = (
	id: string,
	lastName: string,
	studentsCount: number,
	ratingsCount = studentsCount,
): CourseInstructorMentions => ({
	instructor: { id, first_name: "Ім'я", last_name: lastName, patronymic: "" },
	ratings_count: ratingsCount,
	offering_ratings_count: 0,
	students_count: studentsCount,
	recent_students_count: studentsCount,
	planned: false,
});

describe("namedCourseTeachers", () => {
	it("keeps teachers named at least twice, most named first", () => {
		const teachers = namedCourseTeachers([
			mention("i-1", "Вигаданий", 2),
			mention("i-2", "Уявна", 1),
			mention("i-3", "Зразкова", 7),
		]);

		expect(teachers).toEqual([
			{ id: "i-3", name: "Зразкова Ім'я", note: "обрали 7 студентів" },
			{ id: "i-1", name: "Вигаданий Ім'я", note: "обрали 2 студенти" },
		]);
	});

	it("counts students, not ratings", () => {
		expect(namedCourseTeachers([mention("i-1", "Вигаданий", 1, 2)])).toEqual(
			[],
		);
	});

	it("gives nothing when nobody was named twice", () => {
		expect(namedCourseTeachers([mention("i-1", "Вигаданий", 1)])).toEqual([]);
	});
});

describe("chosenByNote", () => {
	it.each([
		[2, "обрали 2 студенти"],
		[5, "обрали 5 студентів"],
		[11, "обрали 11 студентів"],
		[21, "обрав 21 студент"],
		[24, "обрали 24 студенти"],
	])("%i → %s", (count, note) => {
		expect(chosenByNote(count)).toBe(note);
	});
});
