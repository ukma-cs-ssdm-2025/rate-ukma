import { describe, expect, it } from "vitest";

import type { SyncChange } from "@/lib/api/generated";
import { linkChange } from "./components/syncTestData";
import {
	academicYear,
	pageNumbers,
	pageSlice,
	tableRow,
	yearFilter,
	yearRangeLabel,
} from "./syncRows";

const offeringChange: SyncChange = {
	...linkChange,
	id: 202,
	group: "new",
	kind: "new_offering",
	after: {
		saz_code: "909770",
		study_year: 2,
		semester: { year: 2019, term: "SUMMER" },
		display: {
			course: {
				title: "Мова `опису` систем",
				department: "Кафедра формальних мов",
			},
		},
	},
};

describe("tableRow", () => {
	it("shows titles, semesters and codes without internal ids", () => {
		// Act
		const row = tableRow(offeringChange, null);

		// Assert
		expect(row).toEqual({
			id: 202,
			title: "Мова ’опису’ систем",
			department: "Кафедра формальних мов",
			semester: "Літо 2019",
			studyYear: "2-й рік",
			sazCode: "909770",
			change: "",
		});
	});

	it("uses the course codes when a row has no own code", () => {
		// Assert
		expect(tableRow(linkChange, null).sazCode).toBe("315421");
	});
});

describe("years", () => {
	it("starts the academic year in August", () => {
		// Assert
		expect(academicYear(new Date(2026, 7, 1))).toBe(2026);
		expect(academicYear(new Date(2026, 6, 31))).toBe(2025);
	});

	it("turns a range into a year filter and a label", () => {
		// Arrange
		const now = new Date(2026, 10, 22);

		// Assert
		expect(yearFilter("all", now)).toEqual({});
		expect(yearFilter("current", now)).toEqual({
			year_from: 2026,
			year_to: 2026,
		});
		expect(yearFilter("earlier", now)).toEqual({ year_to: 2025 });
		expect(yearRangeLabel("current", now)).toBe("2026–2027");
	});
});

describe("pages", () => {
	it("slices a page and clamps it", () => {
		// Arrange
		const items = Array.from({ length: 30 }, (_, index) => index);

		// Act
		const last = pageSlice(items, 9, 12);

		// Assert
		expect(last).toEqual({
			items: items.slice(24),
			page: 3,
			totalPages: 3,
			from: 25,
			to: 30,
		});
		expect(pageSlice([], 1, 12).from).toBe(0);
	});

	it("shows the first, the last and the neighbours with gaps", () => {
		// Assert
		expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
		expect(pageNumbers(1, 57)).toEqual([1, 2, null, 57]);
		expect(pageNumbers(10, 57)).toEqual([1, null, 9, 10, 11, null, 57]);
	});
});
