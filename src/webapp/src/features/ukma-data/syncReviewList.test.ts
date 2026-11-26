import { describe, expect, it } from "vitest";

import type { SyncChange } from "@/lib/api/generated";
import { titleChange } from "./components/dataTestData";
import { countsSummary } from "./sync";
import { fieldValueWord } from "./syncLabels";
import {
	entryIds,
	academicYears,
	nestedText,
	nestLinks,
	visibleFields,
	yearLabel,
} from "./syncReviewList";

const link = (
	id: number,
	kind: string,
	title: string,
	semester: string | null = null,
): SyncChange => ({
	...titleChange,
	id,
	kind,
	group: "link",
	view: { title, place: "Кафедра прикладів", semester, rows: [] },
});

describe("nestLinks", () => {
	it("puts a semester link under the link of its course", () => {
		// Arrange
		const items = [
			link(1, "link_course", "Тестова дисципліна А"),
			link(2, "link_offering", "Тестова дисципліна А", "Осінь 2029"),
			link(3, "link_offering", "Тестова дисципліна Б", "Весна 2030"),
		];

		// Act
		const entries = nestLinks(items);

		// Assert
		expect(entries.map((entry) => entry.change.id)).toEqual([1, 3]);
		expect(entries[0]?.nested.map((child) => child.id)).toEqual([2]);
		expect(entries[0] === undefined ? [] : entryIds(entries[0])).toEqual([
			1, 2,
		]);
	});

	it("names the nested semesters and counts the ones without a name", () => {
		expect(
			nestedText([
				link(2, "link_offering", "А", "Осінь 2029"),
				link(3, "link_offering", "А"),
				link(4, "link_offering", "А"),
			]),
		).toBe("І семестри: Осінь 2029, ще 2 семестри");
	});
});

describe("visibleFields", () => {
	const fields = { a: 1, b: 9, c: 8, d: 7, e: 6, f: 5, g: 4 };

	it("shows the five most frequent fields and keeps the chosen one", () => {
		expect(visibleFields(fields, null, false).map(([name]) => name)).toEqual([
			"b",
			"c",
			"d",
			"e",
			"f",
		]);
		expect(visibleFields(fields, "a", false).at(-1)?.[0]).toBe("a");
		expect(visibleFields(fields, null, true)).toHaveLength(7);
	});
});

describe("words for raw values", () => {
	it("names course states and practice types in Ukrainian", () => {
		expect(fieldValueWord("status", "FINISHED")).toBe("завершений");
		expect(fieldValueWord("practice_type", "SEMINAR")).toBe("семінари");
		expect(fieldValueWord("practice_type", "")).toBe("порожньо");
		expect(fieldValueWord("title", "Бази даних")).toBe("Бази даних");
	});

	it("folds the skipped rows of a read into one line", () => {
		expect(
			countsSummary({ skipped: { no_term: 380, zero_credits: 476 } }),
		).toEqual(["Пропущено: немає семестру 380, нуль кредитів 476"]);
		expect(countsSummary({ skipped: { no_term: 3 } }, false)).toEqual([]);
	});
});

describe("academic years", () => {
	it("starts from the next academic year once September is near", () => {
		expect(academicYears(new Date(2030, 8, 1)).slice(0, 2)).toEqual([
			2031, 2030,
		]);
		expect(academicYears(new Date(2030, 2, 1))[0]).toBe(2030);
		expect(yearLabel(2029)).toBe("2029–2030");
	});
});
