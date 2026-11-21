import { describe, expect, it } from "vitest";

import type { CourseFiltersParamsState } from "./courseFiltersParams";
import {
	CREDITS_RANGE,
	DIFFICULTY_RANGE,
	USEFULNESS_RANGE,
} from "./courseFormatting";
import { transformFiltersToApiParams } from "./filterTransformations";

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
	eduLevel: null,
	page: 1,
	size: 10,
	diffOrder: null,
	useOrder: null,
	reviewSort: null,
};

describe("filterTransformations", () => {
	describe("transformFiltersToApiParams", () => {
		it("should exclude all fields when using default filters", () => {
			const filters = DEFAULT_PARAMS;

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({});
		});

		it("should include search query when provided", () => {
			const filters = {
				...DEFAULT_PARAMS,
				q: "React Programming",
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				name: "React Programming",
			});
		});

		it("should exclude empty search query", () => {
			const filters = {
				...DEFAULT_PARAMS,
				q: "",
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).not.toHaveProperty("name");
		});

		it("should include faculty when provided", () => {
			const filters = {
				...DEFAULT_PARAMS,
				faculty: "faculty-123",
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				faculty: "faculty-123",
			});
		});

		it("should include department when provided", () => {
			const filters = {
				...DEFAULT_PARAMS,
				dept: "dept-456",
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				department: "dept-456",
			});
		});

		it("should include instructor when provided", () => {
			const filters = {
				...DEFAULT_PARAMS,
				instructor: "instructor-789",
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				instructor: "instructor-789",
			});
		});

		it("should include course type when provided", () => {
			const filters = {
				...DEFAULT_PARAMS,
				type: "COMPULSORY" as const,
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				type_kind: "COMPULSORY",
			});
		});

		it("should include speciality when provided", () => {
			const filters = {
				...DEFAULT_PARAMS,
				spec: "spec-101",
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				speciality: "spec-101",
			});
		});

		it("should include semester terms when provided", () => {
			const filters = {
				...DEFAULT_PARAMS,
				term: ["FALL" as const],
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				semester_terms: ["FALL"],
			});
		});

		it("should include semester year as string (academic year range)", () => {
			const filters = {
				...DEFAULT_PARAMS,
				year: "2024–2025",
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				semester_year: "2024–2025",
			});
			expect(typeof result.semester_year).toBe("string");
		});

		it("should exclude semester year when empty string", () => {
			const filters = {
				...DEFAULT_PARAMS,
				year: "",
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).not.toHaveProperty("semester_year");
		});

		it("should include credits range when both year and credits are provided", () => {
			const filters = {
				...DEFAULT_PARAMS,
				year: "2024–2025",
				credits: [3.5, 4.5] as [number, number],
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				semester_year: "2024–2025",
				credits_min: 3.5,
				credits_max: 4.5,
			});
		});

		it("should exclude credits range when year is not selected", () => {
			const filters = {
				...DEFAULT_PARAMS,
				credits: [3.5, 4.5] as [number, number],
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).not.toHaveProperty("credits_min");
			expect(result).not.toHaveProperty("credits_max");
		});

		it("should include difficulty range when modified from default", () => {
			const filters = {
				...DEFAULT_PARAMS,
				diff: [2, 4.5] as [number, number],
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				avg_difficulty_min: 2,
				avg_difficulty_max: 4.5,
			});
		});

		it("should exclude difficulty range when matching default range", () => {
			const filters = {
				...DEFAULT_PARAMS,
				diff: DIFFICULTY_RANGE,
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).not.toHaveProperty("avg_difficulty_min");
			expect(result).not.toHaveProperty("avg_difficulty_max");
		});

		it("should include difficulty range when only min is modified", () => {
			const filters = {
				...DEFAULT_PARAMS,
				diff: [2.5, DIFFICULTY_RANGE[1]] as [number, number],
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toHaveProperty("avg_difficulty_min", 2.5);
			expect(result).toHaveProperty("avg_difficulty_max", DIFFICULTY_RANGE[1]);
		});

		it("should include difficulty range when only max is modified", () => {
			const filters = {
				...DEFAULT_PARAMS,
				diff: [DIFFICULTY_RANGE[0], 3.5] as [number, number],
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toHaveProperty("avg_difficulty_min", DIFFICULTY_RANGE[0]);
			expect(result).toHaveProperty("avg_difficulty_max", 3.5);
		});

		it("should include usefulness range when modified from default", () => {
			const filters = {
				...DEFAULT_PARAMS,
				use: [3, 5] as [number, number],
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				avg_usefulness_min: 3,
				avg_usefulness_max: 5,
			});
		});

		it("should exclude usefulness range when matching default range", () => {
			const filters = {
				...DEFAULT_PARAMS,
				use: USEFULNESS_RANGE,
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).not.toHaveProperty("avg_usefulness_min");
			expect(result).not.toHaveProperty("avg_usefulness_max");
		});

		it("should handle multiple filters at once", () => {
			const filters = {
				...DEFAULT_PARAMS,
				q: "Database Systems",
				faculty: "faculty-1",
				dept: "dept-2",
				instructor: "instructor-3",
				term: ["SPRING" as const],
				year: "2024–2025",
				type: "ELECTIVE" as const,
				spec: "spec-4",
				diff: [2, 4] as [number, number],
				use: [3.5, 5] as [number, number],
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				name: "Database Systems",
				faculty: "faculty-1",
				department: "dept-2",
				instructor: "instructor-3",
				semester_terms: ["SPRING"],
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
			const filters = {
				...DEFAULT_PARAMS,
				faculty: "faculty-1",
				year: "",
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toEqual({
				faculty: "faculty-1",
			});
			expect(result).not.toHaveProperty("semester_year");
		});

		it("should map type to type_kind in API params", () => {
			const filters = {
				...DEFAULT_PARAMS,
				type: "COMPULSORY" as const,
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toHaveProperty("type_kind", "COMPULSORY");
			expect(result).not.toHaveProperty("type");
		});

		it("should map q to name in API params", () => {
			const filters = {
				...DEFAULT_PARAMS,
				q: "Test Course",
			};

			const result = transformFiltersToApiParams(filters);

			expect(result).toHaveProperty("name", "Test Course");
			expect(result).not.toHaveProperty("q");
		});
	});
});
