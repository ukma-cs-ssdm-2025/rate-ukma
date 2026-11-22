import { describe, expect, it } from "vitest";

import { NOW, removalCase, studentCase } from "./components/caseTestData";
import {
	academicYear,
	candidateIds,
	openGroups,
	openLineTitle,
	pageSlice,
	waitedFor,
} from "./reviewCases";

describe("review case words", () => {
	it("reads candidate ids from a list or an object", () => {
		expect(candidateIds(studentCase(1))).toEqual(["stu-test-a", "stu-test-b"]);
		expect(
			candidateIds({ ...studentCase(1), candidates: ["a", "b", "c"] }),
		).toHaveLength(3);
		expect(candidateIds({ ...studentCase(1), candidates: null })).toEqual([]);
		expect(academicYear(removalCase)).toBe(2029);
	});

	it("names counts with Ukrainian plurals", () => {
		expect(openLineTitle("student_match", 1, null)).toBe(
			"1 справа про студента чекає рішення",
		);
		expect(openLineTitle("student_match", 3, null)).toBe(
			"3 справи про студентів чекають рішення",
		);
		expect(openLineTitle("instructor_match", 11, null)).toBe(
			"11 справ про викладачів чекають рішення",
		);
	});

	it("says how long the oldest case waits", () => {
		expect(waitedFor("2030-09-10T02:00:00Z", NOW)).toBe("менше доби");
		expect(waitedFor("2030-09-08T11:00:00Z", NOW)).toBe("2 дні");
	});

	it("groups open cases by kind with the oldest date", () => {
		const groups = openGroups([
			studentCase(1, { opened_at: "2030-09-05T00:00:00Z" }),
			studentCase(2, { opened_at: "2030-09-01T00:00:00Z" }),
			studentCase(3, { status: "decided" }),
		]);
		expect(groups).toEqual([
			{ kind: "student_match", count: 2, oldest: "2030-09-01T00:00:00Z" },
		]);
	});

	it("clamps the page into range", () => {
		expect(pageSlice([1, 2, 3], 9)).toEqual({
			rows: [1, 2, 3],
			page: 1,
			totalPages: 1,
		});
	});
});
