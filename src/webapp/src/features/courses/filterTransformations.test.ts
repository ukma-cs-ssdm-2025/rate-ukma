import { describe, expect, it } from "vitest";

import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "./courseFormatting";
import { DEFAULT_FILTERS } from "./filterSchema";
import {
	transformFiltersToApiParams,
	transformSortingToApiParams,
} from "./filterTransformations";

describe("filterTransformations", () => {
	describe("transformFiltersToApiParams", () => {
		it("should exclude all fields when using default filters", () => {
			// Arrange
			const filters = DEFAULT_FILTERS;

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			// All empty strings and default ranges should be excluded
			expect(result).toEqual({});
		});

		it("should include search query when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				searchQuery: "React Programming",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				name: "React Programming",
			});
		});

		it("should exclude empty search query", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				searchQuery: "",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).not.toHaveProperty("name");
		});

		it("should include faculty when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				faculty: "faculty-123",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				faculty: "faculty-123",
			});
		});

		it("should include department when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				department: "dept-456",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				department: "dept-456",
			});
		});

		it("should include instructor when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				instructor: "instructor-789",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				instructor: "instructor-789",
			});
		});

		it("should include course type when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				courseType: "MANDATORY",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				typeKind: "MANDATORY",
			});
		});

		it("should include speciality when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				speciality: "spec-101",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				speciality: "spec-101",
			});
		});

		it("should include semester term when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				semesterTerm: "FALL",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				semesterTerm: "FALL",
			});
		});

		it("should convert semester year string to number", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				semesterYear: "2024",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				semesterYear: 2024,
			});
			expect(typeof result.semesterYear).toBe("number");
		});

		it("should exclude semester year when empty string", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				semesterYear: "",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).not.toHaveProperty("semesterYear");
		});

		it("should include difficulty range when modified from default", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				difficultyRange: [2.0, 4.5] as [number, number],
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				avg_difficulty_min: 2.0,
				avg_difficulty_max: 4.5,
			});
		});

		it("should exclude difficulty range when matching default range", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				difficultyRange: DIFFICULTY_RANGE,
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).not.toHaveProperty("avg_difficulty_min");
			expect(result).not.toHaveProperty("avg_difficulty_max");
		});

		it("should include difficulty range when only min is modified", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				difficultyRange: [2.5, DIFFICULTY_RANGE[1]] as [number, number],
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toHaveProperty("avg_difficulty_min", 2.5);
			expect(result).toHaveProperty("avg_difficulty_max", DIFFICULTY_RANGE[1]);
		});

		it("should include difficulty range when only max is modified", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				difficultyRange: [DIFFICULTY_RANGE[0], 3.5] as [number, number],
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toHaveProperty("avg_difficulty_min", DIFFICULTY_RANGE[0]);
			expect(result).toHaveProperty("avg_difficulty_max", 3.5);
		});

		it("should include usefulness range when modified from default", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				usefulnessRange: [3.0, 5.0] as [number, number],
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				avg_usefulness_min: 3.0,
				avg_usefulness_max: 5.0,
			});
		});

		it("should exclude usefulness range when matching default range", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				usefulnessRange: USEFULNESS_RANGE,
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).not.toHaveProperty("avg_usefulness_min");
			expect(result).not.toHaveProperty("avg_usefulness_max");
		});

		it("should handle multiple filters at once", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				searchQuery: "Database Systems",
				faculty: "faculty-1",
				department: "dept-2",
				instructor: "instructor-3",
				semesterTerm: "SPRING",
				semesterYear: "2025",
				courseType: "ELECTIVE",
				speciality: "spec-4",
				difficultyRange: [2.0, 4.0] as [number, number],
				usefulnessRange: [3.5, 5.0] as [number, number],
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				name: "Database Systems",
				faculty: "faculty-1",
				department: "dept-2",
				instructor: "instructor-3",
				semesterTerm: "SPRING",
				semesterYear: 2025,
				typeKind: "ELECTIVE",
				speciality: "spec-4",
				avg_difficulty_min: 2.0,
				avg_difficulty_max: 4.0,
				avg_usefulness_min: 3.5,
				avg_usefulness_max: 5.0,
			});
		});

		it("should exclude undefined values", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				faculty: "faculty-1",
				semesterYear: "", // This becomes undefined after conversion
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				faculty: "faculty-1",
			});
			expect(result).not.toHaveProperty("semesterYear");
		});

		it("should map courseType to typeKind in API params", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				courseType: "MANDATORY",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toHaveProperty("typeKind", "MANDATORY");
			expect(result).not.toHaveProperty("courseType");
		});

		it("should map searchQuery to name in API params", () => {
			// Arrange
			const filters = {
				...DEFAULT_FILTERS,
				searchQuery: "Test Course",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toHaveProperty("name", "Test Course");
			expect(result).not.toHaveProperty("searchQuery");
		});
	});

	describe("transformSortingToApiParams", () => {
		it("should transform avg_difficulty ascending sort", () => {
			// Arrange
			const sortingId = "avg_difficulty";
			const isDescending = false;

			// Act
			const result = transformSortingToApiParams(sortingId, isDescending);

			// Assert
			expect(result).toEqual({
				avg_difficulty_order: "asc",
			});
		});

		it("should transform avg_difficulty descending sort", () => {
			// Arrange
			const sortingId = "avg_difficulty";
			const isDescending = true;

			// Act
			const result = transformSortingToApiParams(sortingId, isDescending);

			// Assert
			expect(result).toEqual({
				avg_difficulty_order: "desc",
			});
		});

		it("should transform avg_usefulness ascending sort", () => {
			// Arrange
			const sortingId = "avg_usefulness";
			const isDescending = false;

			// Act
			const result = transformSortingToApiParams(sortingId, isDescending);

			// Assert
			expect(result).toEqual({
				avg_usefulness_order: "asc",
			});
		});

		it("should transform avg_usefulness descending sort", () => {
			// Arrange
			const sortingId = "avg_usefulness";
			const isDescending = true;

			// Act
			const result = transformSortingToApiParams(sortingId, isDescending);

			// Assert
			expect(result).toEqual({
				avg_usefulness_order: "desc",
			});
		});

		it("should return empty object for unknown sorting column", () => {
			// Arrange
			const unknownSortingId = "unknown_column";
			const isDescending = false;

			// Act
			const result = transformSortingToApiParams(
				unknownSortingId,
				isDescending,
			);

			// Assert
			expect(result).toEqual({});
		});

		it("should return empty object for title column (not sortable)", () => {
			// Arrange
			const titleColumn = "title";
			const isDescending = false;

			// Act
			const result = transformSortingToApiParams(titleColumn, isDescending);

			// Assert
			expect(result).toEqual({});
		});

		it("should return empty object for ratings_count column (not sortable)", () => {
			// Arrange
			const ratingsColumn = "ratings_count";
			const isDescending = false;

			// Act
			const result = transformSortingToApiParams(ratingsColumn, isDescending);

			// Assert
			expect(result).toEqual({});
		});
	});
});
