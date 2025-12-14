import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createMockFilterOptions } from "@/test-utils/factories";
import { useCourseFiltersData } from "./useCourseFiltersData";
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "../courseFormatting";

const DEFAULT_PARAMS: CourseFiltersParamsState = {
	q: "",
	diff: DIFFICULTY_RANGE,
	use: USEFULNESS_RANGE,
	faculty: "",
	dept: "",
	instructor: "",
	term: null,
	year: "",
	type: null,
	spec: "",
	page: 1,
	size: 10,
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

const MOCK_INSTRUCTORS = {
	IVAN: { id: "instructor-1", name: "Іван Іванович" },
} as const;

const MOCK_SPECIALITIES = {
	SOFTWARE: {
		id: "spec-1",
		name: "Інженерія програмного забезпечення",
		faculty_id: "fac-1",
		faculty_name: "ФІ",
	},
} as const;

const MOCK_SEMESTER_TERMS = {
	FALL: { value: "FALL", label: "Осінь" },
	SPRING: { value: "SPRING", label: "Весна" },
} as const;

const MOCK_SEMESTER_YEARS = {
	Y2024: { value: "2024", label: "2024" },
	Y2025: { value: "2025", label: "2025" },
} as const;

const MOCK_COURSE_TYPES = {
	COMPULSORY: { value: "COMPULSORY", label: "Обов'язковий" },
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

describe("useCourseFiltersData", () => {
	describe("Range Filters", () => {
		it("should return difficulty and usefulness range configurations", () => {
			// Act
			const { result } = renderFiltersHook();

			// Assert
			expect(result.current.rangeFilters).toHaveLength(2);
			expect(result.current.rangeFilters[0].key).toBe("diff");
			expect(result.current.rangeFilters[0].label).toBe("Складність");
			expect(result.current.rangeFilters[1].key).toBe("use");
			expect(result.current.rangeFilters[1].label).toBe("Корисність");
		});

		it("should include current filter values in range configs", () => {
			// Act
			const { result } = renderFiltersHook({
				diff: [2, 4] as [number, number],
			});

			// Assert
			const difficultyFilter = result.current.rangeFilters.find(
				(f) => f.key === "diff",
			);
			expect(difficultyFilter?.value).toEqual([2, 4]);
		});

		it("should include range bounds in configurations", () => {
			// Act
			const { result } = renderFiltersHook();

			// Assert
			const difficultyFilter = result.current.rangeFilters.find(
				(f) => f.key === "diff",
			);
			expect(difficultyFilter?.range).toEqual([1, 5]);
		});

		it("should include captions for range filters", () => {
			// Act
			const { result } = renderFiltersHook();

			// Assert
			const difficultyFilter = result.current.rangeFilters.find(
				(f) => f.key === "diff",
			);
			expect(difficultyFilter?.captions).toEqual(["Легко", "Складно"]);

			const usefulnessFilter = result.current.rangeFilters.find(
				(f) => f.key === "use",
			);
			expect(usefulnessFilter?.captions).toEqual(["Низька", "Висока"]);
		});
	});

	describe("Select Filters", () => {
		it("should return all select filter configurations", () => {
			// Act
			const { result } = renderFiltersHook();

			// Assert
			expect(result.current.selectFilters).toHaveLength(6);
			const filterKeys = result.current.selectFilters.map((f) => f.key);
			expect(filterKeys).toEqual([
				"term",
				"year",
				"faculty",
				"dept",
				"spec",
				"type",
				// "instructor", // Disabled
			]);
		});

		it("should map filter options to select options", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [MOCK_FACULTIES.FI, MOCK_FACULTIES.FEN],
			});

			// Act
			const { result } = renderFiltersHook({}, filterOptions);

			// Assert
			const facultyFilter = result.current.selectFilters.find(
				(f) => f.key === "faculty",
			);
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
			const facultyFilter = result.current.selectFilters.find(
				(f) => f.key === "faculty",
			);
			expect(facultyFilter?.value).toBe("fac-1");
		});

		it("should handle empty filter options gracefully", () => {
			// Act
			const { result } = renderFiltersHookWithoutOptions();

			// Assert
			result.current.selectFilters.forEach((filter) => {
				if (filter.useCombobox) {
					expect(filter.options).toHaveLength(1);
					expect(filter.options[0].value).toBe("");
				} else {
					expect(filter.options).toEqual([]);
				}
			});
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
			const departmentFilter = result.current.selectFilters.find(
				(f) => f.key === "dept",
			);
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
			const departmentFilter = result.current.selectFilters.find(
				(f) => f.key === "dept",
			);
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
			const departmentFilter = result.current.selectFilters.find(
				(f) => f.key === "dept",
			);
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
			const departmentFilter = result.current.selectFilters.find(
				(f) => f.key === "dept",
			);
			// Without faculty selected, labels include 'All' option at index 0
			expect(departmentFilter?.options[1].label).toBe(
				"Кафедра мультимедійних систем",
			);
		});
	});

	describe("Active Badges", () => {
		it("should show no badges when using default filters", () => {
			// Act
			const { result } = renderFiltersHook();

			// Assert
			expect(result.current.activeBadges).toHaveLength(0);
			expect(result.current.hasActiveFilters).toBe(false);
		});

		it("should show badge for search query", () => {
			// Act
			const { result } = renderFiltersHook({ q: "React" });

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "search",
				label: "Пошук: React",
			});
			expect(result.current.hasActiveFilters).toBe(true);
		});

		it("should show badge for modified difficulty range", () => {
			// Act
			const { result } = renderFiltersHook({
				diff: [2, 4] as [number, number],
			});

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "difficulty",
				label: "Складність: 2-4",
			});
		});

		it("should not show badge for default difficulty range", () => {
			// Act
			const { result } = renderFiltersHook({
				diff: [1, 5] as [number, number],
			});

			// Assert
			const difficultyBadge = result.current.activeBadges.find(
				(b) => b.key === "difficulty",
			);
			expect(difficultyBadge).toBeUndefined();
		});

		it("should show badge for modified usefulness range", () => {
			// Act
			const { result } = renderFiltersHook({
				use: [3, 5] as [number, number],
			});

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "usefulness",
				label: "Корисність: 3-5",
			});
		});

		it("should show badge for selected faculty", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [MOCK_FACULTIES.FI],
			});

			// Act
			const { result } = renderFiltersHook({ faculty: "fac-1" }, filterOptions);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "faculty",
				label: "Факультет: ФІ · Факультет інформатики",
			});
		});

		it("should show badge for selected department", () => {
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
			}); // Act
			const { result } = renderFiltersHook({ dept: "dept-1" }, filterOptions);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "department",
				label: "Кафедра: Кафедра мультимедійних систем",
			});
		});

		it("should show badge for selected instructor", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				instructors: [MOCK_INSTRUCTORS.IVAN],
			});

			// Act
			const { result } = renderFiltersHook(
				{ instructor: "instructor-1" },
				filterOptions,
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "instructor",
				label: "Викладач: Іван Іванович",
			});
		});

		it("should show combined semester badge when both year and term selected", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				semester_years: [MOCK_SEMESTER_YEARS.Y2024],
				semester_terms: [MOCK_SEMESTER_TERMS.FALL],
			});

			// Act
			const { result } = renderFiltersHook(
				{ year: "2024", term: "FALL" },
				filterOptions,
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "semester",
				label: "Семестр: 2024 Осінь",
			});
		});

		it("should show separate term badge when only term selected", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				semester_terms: [MOCK_SEMESTER_TERMS.SPRING],
			});

			// Act
			const { result } = renderFiltersHook({ term: "SPRING" }, filterOptions);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "semesterTerm",
				label: "Період: Весна",
			});
		});

		it("should show separate year badge when only year selected", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				semester_years: [MOCK_SEMESTER_YEARS.Y2025],
			});

			// Act
			const { result } = renderFiltersHook({ year: "2025" }, filterOptions);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "semesterYear",
				label: "Навчальний рік: 2025",
			});
		});

		it("should show badge for selected course type", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				course_types: [MOCK_COURSE_TYPES.COMPULSORY],
			});

			// Act
			const { result } = renderFiltersHook(
				{ type: "COMPULSORY" },
				filterOptions,
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "courseType",
				label: "Тип курсу: Обов'язковий",
			});
		});

		it("should show badge for selected speciality", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [
					{
						id: "fac-1",
						name: "ФІ",
						departments: [],
						specialities: [MOCK_SPECIALITIES.SOFTWARE],
					},
				],
			}); // Act
			const { result } = renderFiltersHook({ spec: "spec-1" }, filterOptions);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "speciality",
				label: "Спеціальність: Інженерія програмного забезпечення",
			});
		});

		it("should show multiple badges when multiple filters applied", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [MOCK_FACULTIES.FI],
			});

			// Act
			const { result } = renderFiltersHook(
				{
					q: "Database",
					faculty: "fac-1",
					diff: [2, 4] as [number, number],
				},
				filterOptions,
			);

			// Assert
			expect(result.current.activeBadges).toHaveLength(3);
			expect(result.current.hasActiveFilters).toBe(true);
		});
	});
});
