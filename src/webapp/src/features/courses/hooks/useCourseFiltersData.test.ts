import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createMockFilterOptions } from "@/test-utils/factories";
import { useCourseFiltersData } from "./useCourseFiltersData";
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import {
	CREDITS_RANGE,
	DIFFICULTY_RANGE,
	USEFULNESS_RANGE,
} from "../courseFormatting";

const DEFAULT_PARAMS: CourseFiltersParamsState = {
	q: "",
	diff: DIFFICULTY_RANGE,
	use: USEFULNESS_RANGE,
	faculty: "",
	dept: "",
	instructor: "",
	term: [],
	year: "",
	credits: CREDITS_RANGE,
	type: null,
	spec: "",
	page: 1,
	size: 10,
	diffOrder: null,
	useOrder: null,
};

// Shared mock data
const MOCK_FACULTIES = {
	FI: {
		id: "fac-1",
		name: "Факультет інформатики",
		departments: [],
		specialities: [],
	},
	FEN: {
		id: "fac-2",
		name: "Факультет економічних наук",
		departments: [],
		specialities: [],
	},
};

const MOCK_DEPARTMENTS = {
	PROGRAMMING: {
		id: "dept-1",
		name: "Кафедра мультимедійних систем",
		faculty_id: "fac-1",
		faculty_name: "ФІ",
		faculty_custom_abbreviation: "ФІ",
	},
	ECONOMICS: {
		id: "dept-2",
		name: "Кафедра фінансів",
		faculty_id: "fac-2",
		faculty_name: "ФЕН",
		faculty_custom_abbreviation: "ФЕН",
	},
	DATABASES: {
		id: "dept-3",
		name: "Кафедра інформаційних систем",
		faculty_id: "fac-1",
		faculty_name: "ФІ",
		faculty_custom_abbreviation: "ФІ",
	},
} as const;

/**
 * Helper to render useCourseFiltersData hook with params
 */
function renderFiltersHook(
	paramsOverrides: Partial<CourseFiltersParamsState> = {},
	filterOptions?: ReturnType<typeof createMockFilterOptions>,
) {
	const params = { ...DEFAULT_PARAMS, ...paramsOverrides };

	return renderHook(() =>
		useCourseFiltersData({
			params,
			filterOptions: filterOptions ?? createMockFilterOptions(),
		}),
	);
}

/**
 * Helper to render hook with explicitly undefined filter options
 */
function renderFiltersHookWithoutOptions(
	paramsOverrides: Partial<CourseFiltersParamsState> = {},
) {
	const params = { ...DEFAULT_PARAMS, ...paramsOverrides };

	return renderHook(() =>
		useCourseFiltersData({
			params,
			filterOptions: undefined,
		}),
	);
}

/** Flatten all range filters from groups for convenience */
function allRangeFilters(data: ReturnType<typeof useCourseFiltersData>) {
	return [
		...data.groups.rating.rangeFilters,
		...data.groups.semester.rangeFilters,
	];
}

/** Flatten all select filters from groups for convenience */
function allSelectFilters(data: ReturnType<typeof useCourseFiltersData>) {
	return [
		...data.groups.semester.selectFilters,
		...data.groups.structure.selectFilters,
	];
}

describe("useCourseFiltersData", () => {
	describe("Range Filters", () => {
		it("should return difficulty, usefulness, and credits range configurations", () => {
			// Act
			const { result } = renderFiltersHook();

			// Assert
			const ranges = allRangeFilters(result.current);
			expect(ranges).toHaveLength(3);
			expect(ranges[0].key).toBe("diff");
			expect(ranges[0].label).toBe("Складність");
			expect(ranges[1].key).toBe("use");
			expect(ranges[1].label).toBe("Корисність");
			expect(ranges[2].key).toBe("credits");
			expect(ranges[2].label).toBe("Кредити ECTS");
		});

		it("should include current filter values in range configs", () => {
			// Act
			const { result } = renderFiltersHook({
				diff: [2, 4] as [number, number],
			});

			// Assert
			const ranges = allRangeFilters(result.current);
			const difficultyFilter = ranges.find((f) => f.key === "diff");
			expect(difficultyFilter?.value).toEqual([2, 4]);
		});

		it("should include range bounds in configurations", () => {
			// Act
			const { result } = renderFiltersHook();

			// Assert
			const ranges = allRangeFilters(result.current);
			const difficultyFilter = ranges.find((f) => f.key === "diff");
			expect(difficultyFilter?.range).toEqual([1, 5]);
		});

		it("should include captions for range filters", () => {
			// Act
			const { result } = renderFiltersHook();

			// Assert
			const ranges = allRangeFilters(result.current);
			const difficultyFilter = ranges.find((f) => f.key === "diff");
			expect(difficultyFilter?.captions).toEqual(["Легко", "Складно"]);

			const usefulnessFilter = ranges.find((f) => f.key === "use");
			expect(usefulnessFilter?.captions).toEqual(["Низька", "Висока"]);
		});
	});

	describe("Select Filters", () => {
		it("should return all select filter configurations", () => {
			// Act
			const { result } = renderFiltersHook();

			// Assert
			const selects = allSelectFilters(result.current);
			expect(selects).toHaveLength(5);
			const filterKeys = selects.map((f) => f.key);
			expect(filterKeys).toEqual(["year", "faculty", "dept", "spec", "type"]);
		});

		it("should map filter options to select options", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [MOCK_FACULTIES.FI, MOCK_FACULTIES.FEN],
			});

			// Act
			const { result } = renderFiltersHook({}, filterOptions);

			// Assert
			const selects = allSelectFilters(result.current);
			const facultyFilter = selects.find((f) => f.key === "faculty");
			expect(facultyFilter?.options).toHaveLength(3); // Includes 'All' option
			expect(facultyFilter?.options[0]).toEqual({
				value: "",
				label: "Усі факультети",
			});
			expect(facultyFilter?.options[1]).toEqual({
				value: "fac-1",
				label: "Факультет інформатики",
			});
		});

		it("should include current filter values in select configs", () => {
			// Act
			const { result } = renderFiltersHook({ faculty: "fac-1" });

			// Assert
			const selects = allSelectFilters(result.current);
			const facultyFilter = selects.find((f) => f.key === "faculty");
			expect(facultyFilter?.value).toBe("fac-1");
		});

		it("should handle empty filter options gracefully", () => {
			// Act
			const { result } = renderFiltersHookWithoutOptions();

			// Assert
			const selects = allSelectFilters(result.current);
			selects.forEach((filter) => {
				if (filter.useCombobox) {
					expect(filter.options).toHaveLength(1);
					expect(filter.options[0].value).toBe("");
					return;
				}

				expect(filter.options).toEqual([]);
			});
		});

		it("should disable credits filter until year is selected", () => {
			// Act
			const { result } = renderFiltersHook({ year: "" });

			// Assert
			const ranges = allRangeFilters(result.current);
			const creditsFilter = ranges.find((filter) => filter.key === "credits");
			expect(creditsFilter?.disabled).toBe(true);
		});

		it("should enable credits filter when year is selected", () => {
			// Act
			const { result } = renderFiltersHook({ year: "2024–2025" });

			// Assert
			const ranges = allRangeFilters(result.current);
			const creditsFilter = ranges.find((filter) => filter.key === "credits");
			expect(creditsFilter?.disabled).toBe(false);
		});
	});

	describe("Department Filtering by Faculty", () => {
		it("should show all departments when no faculty is selected", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [
					{
						id: "fac-1",
						name: "Факультет інформатики",
						departments: [
							MOCK_DEPARTMENTS.PROGRAMMING,
							MOCK_DEPARTMENTS.DATABASES,
						],
						specialities: [],
					},
					{
						id: "fac-2",
						name: "Факультет економічних наук",
						departments: [MOCK_DEPARTMENTS.ECONOMICS],
						specialities: [],
					},
				],
			});

			// Act
			const { result } = renderFiltersHook({}, filterOptions);

			// Assert
			const selects = allSelectFilters(result.current);
			const departmentFilter = selects.find((f) => f.key === "dept");
			expect(departmentFilter?.options).toHaveLength(4); // 1 All + 3 departments
		});
		it("should filter departments by selected faculty", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [
					{
						id: "fac-1",
						name: "Факультет інформатики",
						departments: [
							MOCK_DEPARTMENTS.PROGRAMMING,
							MOCK_DEPARTMENTS.DATABASES,
						],
						specialities: [],
					},
					{
						id: "fac-2",
						name: "Факультет економічних наук",
						departments: [MOCK_DEPARTMENTS.ECONOMICS],
						specialities: [],
					},
				],
			});

			// Act
			const { result } = renderFiltersHook({ faculty: "fac-1" }, filterOptions);

			// Assert
			const selects = allSelectFilters(result.current);
			const departmentFilter = selects.find((f) => f.key === "dept");
			expect(departmentFilter?.options).toHaveLength(3); // Includes 'All' option
			expect(departmentFilter?.options.map((o) => o.value)).toEqual([
				"", // 'All' option
				"dept-1",
				"dept-3",
			]);
		});

		it("should show department name without faculty when faculty is selected", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [
					{
						id: "fac-1",
						name: "Факультет інформатики",
						departments: [MOCK_DEPARTMENTS.PROGRAMMING],
						specialities: [],
					},
				],
			});

			// Act
			const { result } = renderFiltersHook({ faculty: "fac-1" }, filterOptions);

			// Assert
			const selects = allSelectFilters(result.current);
			const departmentFilter = selects.find((f) => f.key === "dept");
			expect(departmentFilter?.options[1].label).toBe(
				"Кафедра мультимедійних систем",
			);
		});

		it("should show department with faculty name when no faculty selected", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [
					{
						id: "fac-1",
						name: "ФІ",
						departments: [MOCK_DEPARTMENTS.PROGRAMMING],
						specialities: [],
					},
				],
			});

			// Act
			const { result } = renderFiltersHook({}, filterOptions);

			// Assert
			const selects = allSelectFilters(result.current);
			const departmentFilter = selects.find((f) => f.key === "dept");
			// Without faculty selected, labels include 'All' option at index 0
			expect(departmentFilter?.options[1].label).toBe(
				"Кафедра мультимедійних систем",
			);
		});
	});

	describe("Filter Groups", () => {
		it("should group filters into rating, semester, and structure", () => {
			// Act
			const { result } = renderFiltersHook();

			// Assert
			expect(result.current.groups.rating.config.id).toBe("rating");
			expect(result.current.groups.semester.config.id).toBe("semester");
			expect(result.current.groups.structure.config.id).toBe("structure");
		});

		it("should count active rating filters", () => {
			// Act
			const { result } = renderFiltersHook({
				diff: [2, 4] as [number, number],
				use: [3, 5] as [number, number],
			});

			// Assert
			expect(result.current.groups.rating.config.activeCount).toBe(2);
		});

		it("should count active semester filters", () => {
			// Act
			const { result } = renderFiltersHook({
				year: "2024",
				term: ["FALL"],
			});

			// Assert
			expect(result.current.groups.semester.config.activeCount).toBe(2);
		});

		it("should count active structure filters", () => {
			// Act
			const { result } = renderFiltersHook({
				faculty: "fac-1",
				spec: "spec-1",
			});

			// Assert
			expect(result.current.groups.structure.config.activeCount).toBe(2);
		});
	});

	describe("Presets", () => {
		it("should detect active easy preset", () => {
			// Act
			const { result } = renderFiltersHook({
				diff: [1, 2.5] as [number, number],
			});

			// Assert
			expect(result.current.activePresetIds).toContain("easy");
		});

		it("should detect active most-useful preset", () => {
			// Act
			const { result } = renderFiltersHook({
				use: [4, 5] as [number, number],
			});

			// Assert
			expect(result.current.activePresetIds).toContain("most-useful");
		});

		it("should not detect presets when filters don't match", () => {
			// Act
			const { result } = renderFiltersHook();

			// Assert
			expect(result.current.activePresetIds).toHaveLength(0);
		});
	});

	describe("hasActiveFilters", () => {
		it("should be false when using default filters", () => {
			const { result } = renderFiltersHook();
			expect(result.current.hasActiveFilters).toBe(false);
		});

		it("should be true when any filter is set", () => {
			const { result } = renderFiltersHook({ q: "React" });
			expect(result.current.hasActiveFilters).toBe(true);
		});
	});
});
