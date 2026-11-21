import { describe, expect, it } from "vitest";

import {
	DIFFICULTY_RANGE,
	formatAcademicYearLabel,
	formatCredits,
	formatDate,
	formatDecimalValue,
	formatWeeklyHours,
	getAcademicStartYear,
	getCourseTypeDisplay,
	getExamTypeDisplay,
	hasCourseScores,
	USEFULNESS_RANGE,
} from "./courseFormatting";

describe("courseFormatting", () => {
	describe("Constants", () => {
		it("should have correct difficulty range", () => {
			// Assert
			expect(DIFFICULTY_RANGE).toEqual([1, 5]);
		});

		it("should have correct usefulness range", () => {
			// Assert
			expect(USEFULNESS_RANGE).toEqual([1, 5]);
		});
	});

	describe("getCourseTypeDisplay", () => {
		it.each([
			["COMPULSORY", "Обов'язковий"],
			["ELECTIVE", "Вибірковий"],
			["PROF_ORIENTED", "Професійно-орієнтований"],
		] as const)(
			"should return Ukrainian label for %s type",
			(type, expected) => {
				expect(getCourseTypeDisplay(type)).toBe(expected);
			},
		);
	});

	describe("getExamTypeDisplay", () => {
		it.each([
			["EXAM", "Іспит"],
			["CREDIT", "Залік"],
		] as const)(
			"maps %s to a Ukrainian control-form label",
			(type, expected) => {
				expect(getExamTypeDisplay(type)).toBe(expected);
			},
		);
	});

	describe("formatDate", () => {
		it("should format valid date string in Ukrainian locale", () => {
			// Arrange
			const dateString = "2025-10-26";

			// Act
			const result = formatDate(dateString);

			// Assert
			expect(result).toBe("26 жовтня 2025 р.");
		});

		it("should format ISO 8601 datetime string", () => {
			// Arrange
			const dateString = "2025-10-26T14:30:00Z";

			// Act
			const result = formatDate(dateString);

			// Assert
			expect(result).toContain("26");
			expect(result).toContain("жовтня");
			expect(result).toContain("2025");
		});

		it("should return em dash for invalid date string", () => {
			// Arrange
			const invalidDate = "not-a-date";

			// Act
			const result = formatDate(invalidDate);

			// Assert
			expect(result).toBe("—");
		});

		it("should return em dash for empty string", () => {
			// Arrange
			const emptyString = "";

			// Act
			const result = formatDate(emptyString);

			// Assert
			expect(result).toBe("—");
		});

		it("should handle different months correctly", () => {
			// Arrange
			const januaryDate = "2025-01-15";

			// Act
			const result = formatDate(januaryDate);

			// Assert
			expect(result).toContain("січня");
		});
	});

	describe("formatDecimalValue", () => {
		it("should strip trailing zero fractions", () => {
			expect(formatDecimalValue(3)).toBe("3");
		});

		it("should keep decimal precision when needed", () => {
			expect(formatDecimalValue(3.5)).toBe("3.5");
		});

		it("should return fallback when value is missing", () => {
			expect(formatDecimalValue(null, { fallback: "N/A" })).toBe("N/A");
		});
	});

	describe("formatCredits", () => {
		it("should format integer credits without decimals", () => {
			expect(formatCredits("5")).toBe("5 ECTS");
		});

		it("should keep one decimal for fractional credits", () => {
			expect(formatCredits("4.5")).toBe("4.5 ECTS");
		});

		it("should pass through unparsable credits with the ECTS suffix", () => {
			expect(formatCredits("багато")).toBe("багато ECTS");
		});

		it("should return null when credits are missing", () => {
			expect(formatCredits(undefined)).toBeNull();
			expect(formatCredits(null)).toBeNull();
			expect(formatCredits("")).toBeNull();
		});
	});

	describe("formatWeeklyHours", () => {
		it("should format weekly hours with the hour label", () => {
			expect(formatWeeklyHours(4)).toBe("4 год");
		});

		it("should return null when hours are missing", () => {
			expect(formatWeeklyHours(undefined)).toBeNull();
			expect(formatWeeklyHours(null)).toBeNull();
		});
	});

	describe("getAcademicStartYear", () => {
		it("should keep the calendar year for an autumn term", () => {
			expect(getAcademicStartYear(2026, "FALL")).toBe(2026);
		});

		it("should map spring and summer terms to the previous year", () => {
			expect(getAcademicStartYear(2026, "SPRING")).toBe(2025);
			expect(getAcademicStartYear(2026, "SUMMER")).toBe(2025);
		});

		it("should return null for unknown terms or missing values", () => {
			expect(getAcademicStartYear(2026, "WINTER")).toBeNull();
			expect(getAcademicStartYear(null, "FALL")).toBeNull();
			expect(getAcademicStartYear(2026, null)).toBeNull();
		});
	});

	describe("formatAcademicYearLabel", () => {
		it("should label an autumn offering with the current and next year", () => {
			expect(formatAcademicYearLabel(2025, "FALL")).toBe("2025–2026");
		});

		it("should label a spring offering with the previous and current year", () => {
			expect(formatAcademicYearLabel(2026, "SPRING")).toBe("2025–2026");
		});

		it("should return an em dash when the year cannot be derived", () => {
			expect(formatAcademicYearLabel(null, "FALL")).toBe("—");
		});
	});

	describe("hasCourseScores", () => {
		it("should be true when the ratings count is positive", () => {
			expect(hasCourseScores(null, null, 4)).toBe(true);
		});

		it("should be true when either score is in range", () => {
			expect(hasCourseScores(4.6, null, 0)).toBe(true);
			expect(hasCourseScores(null, 4.8, null)).toBe(true);
		});

		it("should be false when everything is missing or out of range", () => {
			expect(hasCourseScores(null, null, null)).toBe(false);
			expect(hasCourseScores(9, 0, 0)).toBe(false);
		});
	});
});
