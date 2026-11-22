import { describe, expect, it } from "vitest";

import { NOW, removalCase, studentCase } from "./components/caseTestData";
import {
	academicYear,
	candidateIds,
	openGroups,
	openLineTitle,
	pageSlice,
	receivedText,
	sortCases,
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
			"1 справа про студента чекає рішення в сервісі даних САЗ",
		);
		expect(openLineTitle("student_match", 3, null)).toBe(
			"3 справи про студентів чекають рішення в сервісі даних САЗ",
		);
		expect(openLineTitle("instructor_match", 11, null)).toBe(
			"11 справ про викладачів чекають рішення в сервісі даних САЗ",
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

	it("finds the oldest case by time, not by the text of the date", () => {
		const groups = openGroups([
			studentCase(1, { opened_at: "2030-09-04T20:00:00Z" }),
			studentCase(2, { opened_at: "2030-09-05T00:00:00+05:00" }),
		]);
		expect(groups[0].oldest).toBe("2030-09-05T00:00:00+05:00");
	});

	it("puts open cases oldest first and closed ones newest first", () => {
		const sorted = sortCases([
			studentCase(1, { status: "decided", opened_at: "2030-09-01T00:00:00Z" }),
			studentCase(2, { opened_at: "2030-09-06T00:00:00Z" }),
			studentCase(3, { status: "decided", opened_at: "2030-09-07T00:00:00Z" }),
			studentCase(4, { opened_at: "2030-09-02T00:00:00Z" }),
		]);
		expect(sorted.map((item) => item.id)).toEqual([
			"case-st-4",
			"case-st-2",
			"case-st-3",
			"case-st-1",
		]);
	});

	it("names the day a case was received", () => {
		expect(receivedText("2030-09-03T10:00:00Z")).toBe("Отримано 3 вер.");
	});

	it("clamps the page into range", () => {
		expect(pageSlice([1, 2, 3], 9)).toEqual({
			rows: [1, 2, 3],
			page: 1,
			totalPages: 1,
		});
	});
});
