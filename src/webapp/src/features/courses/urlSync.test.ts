import { describe, expect, it } from "vitest";

import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "./courseFormatting";
import type { FilterState } from "./filterSchema";
import { DEFAULT_FILTERS } from "./filterSchema";
import { filtersToSearchParams, searchParamsToFilters } from "./urlSync";

// Helper to create filters with defaults
function createFilters(overrides: Partial<FilterState> = {}): FilterState {
	return { ...DEFAULT_FILTERS, ...overrides };
}

// Common test values
const TEST_IDS = {
	FACULTY: "faculty-123",
	DEPARTMENT: "dept-456",
	INSTRUCTOR: "instructor-789",
	SPECIALITY: "spec-101",
} as const;

const TEST_RANGES = {
	DIFFICULTY_MODIFIED: [2, 4.5] as [number, number],
	DIFFICULTY_DECIMAL: [2.5, 3.7] as [number, number],
	USEFULNESS_MODIFIED: [3, 5] as [number, number],
	USEFULNESS_DECIMAL: [3.2, 4.8] as [number, number],
} as const;

describe("urlSync", () => {
	describe("filtersToSearchParams", () => {
		it("should return empty object for default filters", () => {
			expect(filtersToSearchParams(DEFAULT_FILTERS)).toEqual({});
		});

		it("should include search query when provided", () => {
			const result = filtersToSearchParams(
				createFilters({ searchQuery: "React Programming" }),
			);
			expect(result).toEqual({ q: "React Programming" });
		});

		it("should exclude empty search query", () => {
			const result = filtersToSearchParams(createFilters({ searchQuery: "" }));
			expect(result).not.toHaveProperty("q");
		});

		it("should include difficulty range when modified", () => {
			const result = filtersToSearchParams(
				createFilters({ difficultyRange: TEST_RANGES.DIFFICULTY_MODIFIED }),
			);
			expect(result).toEqual({ diff: "2-4.5" });
		});

		it("should exclude difficulty range when matching default", () => {
			const result = filtersToSearchParams(
				createFilters({ difficultyRange: DIFFICULTY_RANGE }),
			);
			expect(result).not.toHaveProperty("diff");
		});

		it("should include usefulness range when modified", () => {
			const result = filtersToSearchParams(
				createFilters({ usefulnessRange: TEST_RANGES.USEFULNESS_MODIFIED }),
			);
			expect(result).toEqual({ use: "3-5" });
		});

		it("should exclude usefulness range when matching default", () => {
			const result = filtersToSearchParams(
				createFilters({ usefulnessRange: USEFULNESS_RANGE }),
			);
			expect(result).not.toHaveProperty("use");
		});

		it.each([
			["faculty", { faculty: TEST_IDS.FACULTY }, { faculty: TEST_IDS.FACULTY }],
			[
				"department",
				{ department: TEST_IDS.DEPARTMENT },
				{ dept: TEST_IDS.DEPARTMENT },
			],
			[
				"instructor",
				{ instructor: TEST_IDS.INSTRUCTOR },
				{ instructor: TEST_IDS.INSTRUCTOR },
			],
			["semesterTerm", { semesterTerm: "FALL" }, { term: "FALL" }],
			["semesterYear", { semesterYear: "2024" }, { year: "2024" }],
			["courseType", { courseType: "MANDATORY" }, { type: "MANDATORY" }],
			[
				"speciality",
				{ speciality: TEST_IDS.SPECIALITY },
				{ spec: TEST_IDS.SPECIALITY },
			],
		] as const)("should convert %s to search param", (_, filterOverrides, expectedParams) => {
			const result = filtersToSearchParams(createFilters(filterOverrides));
			expect(result).toEqual(expectedParams);
		});

		it("should include multiple filters", () => {
			const result = filtersToSearchParams(
				createFilters({
					searchQuery: "Database",
					faculty: "faculty-1",
					semesterYear: "2024",
					difficultyRange: [2, 4] as [number, number],
				}),
			);
			expect(result).toEqual({
				q: "Database",
				faculty: "faculty-1",
				year: "2024",
				diff: "2-4",
			});
		});

		it("should exclude all empty string values", () => {
			const result = filtersToSearchParams(
				createFilters({
					faculty: "",
					department: "",
					instructor: "",
					semesterTerm: "",
					semesterYear: "",
					courseType: "",
					speciality: "",
				}),
			);
			expect(result).toEqual({});
		});

		it("should handle decimal values in ranges", () => {
			const result = filtersToSearchParams(
				createFilters({
					difficultyRange: TEST_RANGES.DIFFICULTY_DECIMAL,
					usefulnessRange: TEST_RANGES.USEFULNESS_DECIMAL,
				}),
			);
			expect(result).toEqual({
				diff: "2.5-3.7",
				use: "3.2-4.8",
			});
		});
	});

	describe("searchParamsToFilters", () => {
		it("should return default filters for empty params", () => {
			expect(searchParamsToFilters({})).toEqual(DEFAULT_FILTERS);
		});

		it("should parse search query", () => {
			const result = searchParamsToFilters({ q: "React Programming" });
			expect(result).toEqual(
				createFilters({ searchQuery: "React Programming" }),
			);
		});

		it("should parse difficulty range", () => {
			const result = searchParamsToFilters({ diff: "2-4.5" });
			expect(result.difficultyRange).toEqual([2, 4.5]);
		});

		it("should parse usefulness range", () => {
			const result = searchParamsToFilters({ use: "3-5" });
			expect(result.usefulnessRange).toEqual([3, 5]);
		});

		it.each([
			["faculty", { faculty: TEST_IDS.FACULTY }, "faculty", TEST_IDS.FACULTY],
			[
				"department",
				{ dept: TEST_IDS.DEPARTMENT },
				"department",
				TEST_IDS.DEPARTMENT,
			],
			[
				"instructor",
				{ instructor: TEST_IDS.INSTRUCTOR },
				"instructor",
				TEST_IDS.INSTRUCTOR,
			],
			["semesterTerm", { term: "FALL" }, "semesterTerm", "FALL"],
			["semesterYear", { year: "2024" }, "semesterYear", "2024"],
			["courseType", { type: "MANDATORY" }, "courseType", "MANDATORY"],
			[
				"speciality",
				{ spec: TEST_IDS.SPECIALITY },
				"speciality",
				TEST_IDS.SPECIALITY,
			],
		] as const)("should parse %s from search param", (_, params, filterKey, expectedValue) => {
			const result = searchParamsToFilters(params);
			expect(result[filterKey]).toBe(expectedValue);
		});

		it("should parse multiple parameters", () => {
			const result = searchParamsToFilters({
				q: "Database",
				faculty: "faculty-1",
				year: "2024",
				diff: "2-4",
			});
			expect(result).toEqual(
				createFilters({
					searchQuery: "Database",
					faculty: "faculty-1",
					semesterYear: "2024",
					difficultyRange: [2, 4],
				}),
			);
		});

		it.each([
			["invalid format", { diff: "invalid" }],
			["malformed (too many parts)", { diff: "2-4-5" }],
			["out-of-bounds", { diff: "0-6" }],
			["inverted (min > max)", { diff: "4-2" }],
		])("should fallback to default difficulty range for %s", (_, params) => {
			const result = searchParamsToFilters(params);
			expect(result.difficultyRange).toEqual(DIFFICULTY_RANGE);
		});

		it.each([
			["invalid format", { use: "abc-def" }],
			["out-of-bounds", { use: "0-6" }],
		])("should fallback to default usefulness range for %s", (_, params) => {
			const result = searchParamsToFilters(params);
			expect(result.usefulnessRange).toEqual(USEFULNESS_RANGE);
		});

		it("should handle decimal values in ranges", () => {
			const result = searchParamsToFilters({
				diff: "2.5-3.7",
				use: "3.2-4.8",
			});
			expect(result.difficultyRange).toEqual([2.5, 3.7]);
			expect(result.usefulnessRange).toEqual([3.2, 4.8]);
		});

		it("should ignore unknown parameters", () => {
			const result = searchParamsToFilters({
				q: "Test",
				unknown_param: "value",
				another_unknown: "123",
			});
			expect(result).toEqual(createFilters({ searchQuery: "Test" }));
		});

		it("should handle empty string values gracefully", () => {
			const result = searchParamsToFilters({ q: "", faculty: "", diff: "" });
			expect(result).toEqual(DEFAULT_FILTERS);
		});
	});

	describe("round-trip conversion", () => {
		it("should maintain filter state through round-trip conversion", () => {
			const originalFilters = createFilters({
				searchQuery: "Database Systems",
				faculty: "faculty-1",
				department: "dept-2",
				difficultyRange: [2.5, 4] as [number, number],
				usefulnessRange: [3, 5] as [number, number],
				semesterYear: "2024",
			});

			const params = filtersToSearchParams(originalFilters);
			const reconstructedFilters = searchParamsToFilters(params);

			expect(reconstructedFilters).toEqual(originalFilters);
		});

		it("should maintain default filters through round-trip", () => {
			const params = filtersToSearchParams(DEFAULT_FILTERS);
			const reconstructedFilters = searchParamsToFilters(params);

			expect(reconstructedFilters).toEqual(DEFAULT_FILTERS);
		});
	});
});
