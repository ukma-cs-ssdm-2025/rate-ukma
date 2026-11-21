import { describe, expect, it } from "vitest";

import type { CourseInstructorMentions } from "@/lib/api/generated";
import { chosenByNote, courseTeachers } from "./courseTeachers";

const mention = (
	id: string,
	lastName: string,
	recentStudents: number,
	{ students = recentStudents, planned = false } = {},
): CourseInstructorMentions => ({
	instructor: { id, first_name: "Ім'я", last_name: lastName, patronymic: "" },
	ratings_count: students,
	offering_ratings_count: 0,
	students_count: students,
	recent_students_count: recentStudents,
	planned,
});

describe("courseTeachers", () => {
	it("keeps teachers two students named lately, most named first", () => {
		const teachers = courseTeachers([
			mention("i-1", "Вигаданий", 2),
			mention("i-2", "Уявна", 1),
			mention("i-3", "Зразкова", 7),
		]);

		expect(teachers).toEqual([
			{ id: "i-3", name: "Зразкова Ім'я", note: "обрали 7 студентів" },
			{ id: "i-1", name: "Вигаданий Ім'я", note: "обрали 2 студенти" },
		]);
	});

	it("leaves out picks older than two academic years", () => {
		expect(
			courseTeachers([mention("i-1", "Вигаданий", 1, { students: 4 })]),
		).toEqual([]);
	});

	it("falls back to the planned teachers when nobody was named twice lately", () => {
		expect(
			courseTeachers([
				mention("i-1", "Вигаданий", 1, { planned: true }),
				mention("i-2", "Уявна", 0, { planned: true }),
				mention("i-3", "Зразкова", 1),
			]),
		).toEqual([
			{ id: "i-1", name: "Вигаданий Ім'я", note: "за планом" },
			{ id: "i-2", name: "Уявна Ім'я", note: "за планом" },
		]);
	});

	it("prefers students' picks over the plan", () => {
		expect(
			courseTeachers([
				mention("i-1", "Вигаданий", 3),
				mention("i-2", "Уявна", 0, { planned: true }),
			]).map(({ id }) => id),
		).toEqual(["i-1"]);
	});

	it("gives nothing without picks or a plan", () => {
		expect(courseTeachers([mention("i-1", "Вигаданий", 1)])).toEqual([]);
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
