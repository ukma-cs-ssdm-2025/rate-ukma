import { describe, expect, it } from "vitest";

import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "./courseFormatting";
import { DEFAULT_FILTERS } from "./filterSchema";
import { filtersToSearchParams, searchParamsToFilters } from "./urlSync";

describe("urlSync", () => {
	describe("filtersToSearchParams", () => {
		it("should return empty object for default filters", () => {
			// Arrange
			const filters = DEFAULT_FILTERS;

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({});
		});

		it("should include search query when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				searchQuery: "React Programming",
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({
				q: "React Programming",
			});
		});

		it("should exclude empty search query", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				searchQuery: "",
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).not.toHaveProperty("q");
		});

		it("should include difficulty range when modified", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				difficultyRange: [2.0, 4.5] as [number, number],
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({
				diff: "2-4.5",
			});
		});

		it("should exclude difficulty range when matching default", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				difficultyRange: DIFFICULTY_RANGE,
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).not.toHaveProperty("diff");
		});

		it("should include usefulness range when modified", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				usefulnessRange: [3.0, 5.0] as [number, number],
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({
				use: "3-5",
			});
		});

		it("should exclude usefulness range when matching default", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				usefulnessRange: USEFULNESS_RANGE,
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).not.toHaveProperty("use");
		});

		it("should include faculty when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				faculty: "faculty-123",
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({
				faculty: "faculty-123",
			});
		});

		it("should use short param name for department", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				department: "dept-456",
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({
				dept: "dept-456",
			});
		});

		it("should include instructor when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				instructor: "instructor-789",
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({
				instructor: "instructor-789",
			});
		});

		it("should use short param name for semester term", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				semesterTerm: "FALL",
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({
				term: "FALL",
			});
		});

		it("should use short param name for semester year", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				semesterYear: "2024",
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({
				year: "2024",
			});
		});

		it("should use short param name for course type", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				courseType: "MANDATORY",
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({
				type: "MANDATORY",
			});
		});

		it("should use short param name for speciality", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				speciality: "spec-101",
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({
				spec: "spec-101",
			});
		});

		it("should include multiple filters", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				searchQuery: "Database",
				faculty: "faculty-1",
				semesterYear: "2024",
				difficultyRange: [2.0, 4.0] as [number, number],
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({
				q: "Database",
				faculty: "faculty-1",
				year: "2024",
				diff: "2-4",
			});
		});

		it("should exclude all empty string values", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				faculty: "",
				department: "",
				instructor: "",
				semesterTerm: "",
				semesterYear: "",
				courseType: "",
				speciality: "",
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({});
		});

		it("should handle decimal values in ranges", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				difficultyRange: [2.5, 3.7] as [number, number],
				usefulnessRange: [3.2, 4.8] as [number, number],
			};

			// Act
			const result = filtersToSearchParams(filters);

			// Assert
			expect(result).toEqual({
				diff: "2.5-3.7",
				use: "3.2-4.8",
			});
		});
	});

	describe("searchParamsToFilters", () => {
		it("should return default filters for empty params", () => {
			// Arrange
			const params = {};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result).toEqual(DEFAULT_FILTERS);
		});

		it("should parse search query", () => {
			// Arrange
			const params = {
				q: "React Programming",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result).toEqual({
				...DEFAULT_FILTERS,
				searchQuery: "React Programming",
			});
		});

		it("should parse difficulty range", () => {
			// Arrange
			const params = {
				diff: "2-4.5",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.difficultyRange).toEqual([2.0, 4.5]);
		});

		it("should parse usefulness range", () => {
			// Arrange
			const params = {
				use: "3-5",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.usefulnessRange).toEqual([3.0, 5.0]);
		});

		it("should parse faculty", () => {
			// Arrange
			const params = {
				faculty: "faculty-123",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.faculty).toBe("faculty-123");
		});

		it("should parse department from short param name", () => {
			// Arrange
			const params = {
				dept: "dept-456",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.department).toBe("dept-456");
		});

		it("should parse instructor", () => {
			// Arrange
			const params = {
				instructor: "instructor-789",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.instructor).toBe("instructor-789");
		});

		it("should parse semester term from short param name", () => {
			// Arrange
			const params = {
				term: "FALL",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.semesterTerm).toBe("FALL");
		});

		it("should parse semester year from short param name", () => {
			// Arrange
			const params = {
				year: "2024",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.semesterYear).toBe("2024");
		});

		it("should parse course type from short param name", () => {
			// Arrange
			const params = {
				type: "MANDATORY",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.courseType).toBe("MANDATORY");
		});

		it("should parse speciality from short param name", () => {
			// Arrange
			const params = {
				spec: "spec-101",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.speciality).toBe("spec-101");
		});

		it("should parse multiple parameters", () => {
			// Arrange
			const params = {
				q: "Database",
				faculty: "faculty-1",
				year: "2024",
				diff: "2-4",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result).toEqual({
				...DEFAULT_FILTERS,
				searchQuery: "Database",
				faculty: "faculty-1",
				semesterYear: "2024",
				difficultyRange: [2, 4],
			});
		});

		it("should fallback to default for invalid difficulty range format", () => {
			// Arrange
			const params = {
				diff: "invalid",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.difficultyRange).toEqual(DIFFICULTY_RANGE);
		});

		it("should fallback to default for malformed difficulty range", () => {
			// Arrange
			const params = {
				diff: "2-4-5", // Too many parts
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.difficultyRange).toEqual(DIFFICULTY_RANGE);
		});

		it("should fallback to default for out-of-bounds difficulty range", () => {
			// Arrange
			const params = {
				diff: "0-6", // Outside [1, 5] bounds
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.difficultyRange).toEqual(DIFFICULTY_RANGE);
		});

		it("should fallback to default for inverted difficulty range", () => {
			// Arrange
			const params = {
				diff: "4-2", // min > max
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.difficultyRange).toEqual(DIFFICULTY_RANGE);
		});

		it("should fallback to default for invalid usefulness range format", () => {
			// Arrange
			const params = {
				use: "abc-def",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.usefulnessRange).toEqual(USEFULNESS_RANGE);
		});

		it("should fallback to default for out-of-bounds usefulness range", () => {
			// Arrange
			const params = {
				use: "0-6",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.usefulnessRange).toEqual(USEFULNESS_RANGE);
		});

		it("should handle decimal values in ranges", () => {
			// Arrange
			const params = {
				diff: "2.5-3.7",
				use: "3.2-4.8",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result.difficultyRange).toEqual([2.5, 3.7]);
			expect(result.usefulnessRange).toEqual([3.2, 4.8]);
		});

		it("should ignore unknown parameters", () => {
			// Arrange
			const params = {
				q: "Test",
				unknown_param: "value",
				another_unknown: "123",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result).toEqual({
				...DEFAULT_FILTERS,
				searchQuery: "Test",
			});
		});

		it("should handle empty string values gracefully", () => {
			// Arrange
			const params = {
				q: "",
				faculty: "",
				diff: "",
			};

			// Act
			const result = searchParamsToFilters(params);

			// Assert
			expect(result).toEqual(DEFAULT_FILTERS);
		});
	});

	describe("round-trip conversion", () => {
		it("should maintain filter state through round-trip conversion", () => {
			// Arrange
			const originalFilters = {
				...DEFAULT_FILTERS,
				searchQuery: "Database Systems",
				faculty: "faculty-1",
				department: "dept-2",
				difficultyRange: [2.5, 4.0] as [number, number],
				usefulnessRange: [3.0, 5.0] as [number, number],
				semesterYear: "2024",
			};

			// Act
			const params = filtersToSearchParams(originalFilters);
			const reconstructedFilters = searchParamsToFilters(params);

			// Assert
			expect(reconstructedFilters).toEqual(originalFilters);
		});

		it("should maintain default filters through round-trip", () => {
			// Arrange
			const originalFilters = DEFAULT_FILTERS;

			// Act
			const params = filtersToSearchParams(originalFilters);
			const reconstructedFilters = searchParamsToFilters(params);

			// Assert
			expect(reconstructedFilters).toEqual(originalFilters);
		});
	});
});
