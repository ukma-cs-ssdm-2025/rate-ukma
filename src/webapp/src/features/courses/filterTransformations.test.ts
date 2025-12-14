import { describe, expect, it } from "vitest";

import type { CourseFiltersParamsState } from "./courseFiltersParams";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "./courseFormatting";
import {
	transformFiltersToApiParams,
	transformSortingToApiParams,
} from "./filterTransformations";

const DEFAULT_PARAMS: CourseFiltersParamsState = {
	q: "",
	diff: DIFFICULTY_RANGE,
	use: USEFULNESS_RANGE,
	faculty: "",
	dept: "",
	instructor: "",
	term: "",
	year: "",
	type: "",
	spec: "",
	page: 1,
	size: 10,
};

describe("filterTransformations", () => {
	describe("transformFiltersToApiParams", () => {
		it("should exclude all fields when using default filters", () => {
			// Arrange
			const filters = DEFAULT_PARAMS;

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({});
		});

		it("should include search query when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_PARAMS,
				q: "React Programming",
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
				...DEFAULT_PARAMS,
				q: "",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).not.toHaveProperty("name");
		});

		it("should include faculty when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_PARAMS,
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
				...DEFAULT_PARAMS,
				dept: "dept-456",
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
				...DEFAULT_PARAMS,
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
				...DEFAULT_PARAMS,
				type: "MANDATORY",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				type_kind: "MANDATORY",
			});
		});

		it("should include speciality when provided", () => {
			// Arrange
			const filters = {
				...DEFAULT_PARAMS,
				spec: "spec-101",
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
				...DEFAULT_PARAMS,
				term: "FALL",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				semester_term: "FALL",
			});
		});

		it("should include semester year as string (academic year range)", () => {
			// Arrange
			const filters = {
				...DEFAULT_PARAMS,
				year: "2024–2025",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				semester_year: "2024–2025",
			});
			expect(typeof result.semester_year).toBe("string");
		});

		it("should exclude semester year when empty string", () => {
			// Arrange
			const filters = {
				...DEFAULT_PARAMS,
				year: "",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).not.toHaveProperty("semester_year");
		});

		it("should include difficulty range when modified from default", () => {
			// Arrange
			const filters = {
				...DEFAULT_PARAMS,
				diff: [2, 4.5] as [number, number],
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				avg_difficulty_min: 2,
				avg_difficulty_max: 4.5,
			});
		});

		it("should exclude difficulty range when matching default range", () => {
			// Arrange
			const filters = {
				...DEFAULT_PARAMS,
				diff: DIFFICULTY_RANGE,
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
				...DEFAULT_PARAMS,
				diff: [2.5, DIFFICULTY_RANGE[1]] as [number, number],
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
				...DEFAULT_PARAMS,
				diff: [DIFFICULTY_RANGE[0], 3.5] as [number, number],
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
				...DEFAULT_PARAMS,
				use: [3, 5] as [number, number],
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				avg_usefulness_min: 3,
				avg_usefulness_max: 5,
			});
		});

		it("should exclude usefulness range when matching default range", () => {
			// Arrange
			const filters = {
				...DEFAULT_PARAMS,
				use: USEFULNESS_RANGE,
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
				...DEFAULT_PARAMS,
				q: "Database Systems",
				faculty: "faculty-1",
				dept: "dept-2",
				instructor: "instructor-3",
				term: "SPRING",
				year: "2024–2025",
				type: "ELECTIVE",
				spec: "spec-4",
				diff: [2, 4] as [number, number],
				use: [3.5, 5] as [number, number],
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				name: "Database Systems",
				faculty: "faculty-1",
				department: "dept-2",
				instructor: "instructor-3",
				semester_term: "SPRING",
				semester_year: "2024–2025",
				type_kind: "ELECTIVE",
				speciality: "spec-4",
				avg_difficulty_min: 2,
				avg_difficulty_max: 4,
				avg_usefulness_min: 3.5,
				avg_usefulness_max: 5,
			});
		});

		it("should exclude undefined values", () => {
			// Arrange
			const filters = {
				...DEFAULT_PARAMS,
				faculty: "faculty-1",
				year: "",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toEqual({
				faculty: "faculty-1",
			});
			expect(result).not.toHaveProperty("semester_year");
		});

		it("should map type to type_kind in API params", () => {
			// Arrange
			const filters = {
				...DEFAULT_PARAMS,
				type: "MANDATORY",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toHaveProperty("type_kind", "MANDATORY");
			expect(result).not.toHaveProperty("type");
		});

		it("should map q to name in API params", () => {
			// Arrange
			const filters = {
				...DEFAULT_PARAMS,
				q: "Test Course",
			};

			// Act
			const result = transformFiltersToApiParams(filters);

			// Assert
			expect(result).toHaveProperty("name", "Test Course");
			expect(result).not.toHaveProperty("q");
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
