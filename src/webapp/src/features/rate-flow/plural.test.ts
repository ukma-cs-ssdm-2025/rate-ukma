import { describe, expect, it } from "vitest";

import type { CourseTerm } from "@/lib/course-term";

import { coursesNoun } from "./plural";

const courseWording: CourseTerm = (course) => course;
const disciplineWording: CourseTerm = (_course, discipline) => discipline;

describe("coursesNoun", () => {
	it("agrees with the count in «курс» wording", () => {
		expect(coursesNoun(1, courseWording)).toBe("курс");
		expect(coursesNoun(3, courseWording)).toBe("курси");
		expect(coursesNoun(5, courseWording)).toBe("курсів");
	});

	it.each([
		[1, "дисципліна"],
		[2, "дисципліни"],
		[4, "дисципліни"],
		[5, "дисциплін"],
		[11, "дисциплін"],
		[12, "дисциплін"],
		[21, "дисципліна"],
		[22, "дисципліни"],
		[111, "дисциплін"],
	])("%i → %s", (count, noun) => {
		expect(coursesNoun(count, disciplineWording)).toBe(noun);
	});
});
