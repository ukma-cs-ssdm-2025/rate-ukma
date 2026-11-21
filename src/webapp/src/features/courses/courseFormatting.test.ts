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
	getDifficultyTone,
	getExamTypeDisplay,
	getSemesterDisplay,
	getSemesterTermDisplay,
	getUsefulnessTone,
	hasCourseScores,
	USEFULNESS_RANGE,
} from "./courseFormatting";

describe("courseFormatting", () => {
	describe("Constants", () => {
		it("should have correct difficulty range", () => {
			expect(DIFFICULTY_RANGE).toEqual([1, 5]);
		});

		it("should have correct usefulness range", () => {
			expect(USEFULNESS_RANGE).toEqual([1, 5]);
		});
	});

	describe("getDifficultyTone", () => {
		const TONES = {
			DESTRUCTIVE: "text-destructive",
			MEDIUM: "text-chart-5",
			PRIMARY: "text-primary",
			MUTED: "text-muted-foreground",
		};

		it.each([
			["high difficulty (4.5)", 4.5, TONES.DESTRUCTIVE],
			["exact boundary 4", 4, TONES.DESTRUCTIVE],
			["medium difficulty (3.2)", 3.2, TONES.MEDIUM],
			["exact boundary 3", 3, TONES.MEDIUM],
			["low difficulty (2.1)", 2.1, TONES.PRIMARY],
		])("should return correct tone for %s", (_, value, expected) => {
			expect(getDifficultyTone(value)).toBe(expected);
		});

		it.each([
			["null", null],
			["undefined", undefined],
			["zero", 0],
		])("should return muted tone for %s value", (_, value) => {
			expect(getDifficultyTone(value)).toBe(TONES.MUTED);
		});
	});

	describe("getUsefulnessTone", () => {
		const TONES = {
			PRIMARY: "text-primary",
			MEDIUM: "text-chart-2",
			LOW: "text-muted-foreground",
			MUTED: "text-muted-foreground",
		};

		it.each([
			["high usefulness (4.5)", 4.5, TONES.PRIMARY],
			["medium usefulness (3.2)", 3.2, TONES.MEDIUM],
			["low usefulness (2.1)", 2.1, TONES.LOW],
		])("should return correct tone for %s", (_, value, expected) => {
			expect(getUsefulnessTone(value)).toBe(expected);
		});

		it.each([
			["null", null],
			["undefined", undefined],
		])("should return muted tone for %s value", (_, value) => {
			expect(getUsefulnessTone(value)).toBe(TONES.MUTED);
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

	describe("getSemesterTermDisplay", () => {
		it.each([
			["FALL", "Осінь"],
			["SPRING", "Весна"],
			["SUMMER", "Літо"],
			["fall", "Осінь"],
		])("should return Ukrainian label for %s term", (term, expected) => {
			expect(getSemesterTermDisplay(term)).toBe(expected);
		});

		it("should return fallback for unknown term when provided", () => {
			expect(getSemesterTermDisplay("WINTER", "Зима")).toBe("Зима");
		});

		it("should return original value for unknown term without fallback", () => {
			expect(getSemesterTermDisplay("WINTER")).toBe("WINTER");
		});
	});

	describe("getSemesterDisplay", () => {
		it("should combine term and year into display string", () => {
			const year = 2024;
			const term = "FALL";

			const result = getSemesterDisplay(year, term);

			expect(result).toBe("Осінь 2024");
		});

		it("should use fallback when term is unknown", () => {
			const year = 2024;
			const unknownTerm = "UNKNOWN";
			const fallback = "Невідомо";

			const result = getSemesterDisplay(year, unknownTerm, fallback);

			expect(result).toBe("Невідомо 2024");
		});
	});

	describe("formatDate", () => {
		it("should format valid date string in Ukrainian locale", () => {
			const dateString = "2025-10-26";

			const result = formatDate(dateString);

			expect(result).toBe("26 жовтня 2025 р.");
		});

		it("should format ISO 8601 datetime string", () => {
			const dateString = "2025-10-26T14:30:00Z";

			const result = formatDate(dateString);

			expect(result).toContain("26");
			expect(result).toContain("жовтня");
			expect(result).toContain("2025");
		});

		it("should return em dash for invalid date string", () => {
			const invalidDate = "not-a-date";

			const result = formatDate(invalidDate);

			expect(result).toBe("—");
		});

		it("should return em dash for empty string", () => {
			const emptyString = "";

			const result = formatDate(emptyString);

			expect(result).toBe("—");
		});

		it("should handle different months correctly", () => {
			const januaryDate = "2025-01-15";

			const result = formatDate(januaryDate);

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
