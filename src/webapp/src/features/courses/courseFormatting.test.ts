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
	getFacultyAbbreviation,
	getSemesterDisplay,
	getSemesterTermDisplay,
	getStatusLabel,
	getStatusVariant,
	getTypeKindLabel,
	getTypeKindVariant,
	getUsefulnessTone,
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

	describe("getFacultyAbbreviation", () => {
		it("should return abbreviation from multi-word faculty name", () => {
			// Arrange
			const facultyName = "Факультет інформаційних технологій";

			// Act
			const result = getFacultyAbbreviation(facultyName);

			// Assert
			expect(result).toBe("ФІТ");
		});

		it("should handle single word faculty name", () => {
			// Arrange
			const facultyName = "Факультет";

			// Act
			const result = getFacultyAbbreviation(facultyName);

			// Assert
			expect(result).toBe("Ф");
		});

		it("should handle extra whitespace in faculty name", () => {
			// Arrange
			const facultyName = "  Факультет   інформаційних   технологій  ";

			// Act
			const result = getFacultyAbbreviation(facultyName);

			// Assert
			expect(result).toBe("ФІТ");
		});

		it("should uppercase all letters in abbreviation", () => {
			// Arrange
			const facultyName = "економічний факультет";

			// Act
			const result = getFacultyAbbreviation(facultyName);

			// Assert
			expect(result).toBe("ЕФ");
		});

		it("should handle empty string", () => {
			// Arrange
			const facultyName = "";

			// Act
			const result = getFacultyAbbreviation(facultyName);

			// Assert
			expect(result).toBe("");
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
		])("should return Ukrainian label for %s type", (type, expected) => {
			expect(getCourseTypeDisplay(type)).toBe(expected);
		});

		it("should return fallback for unknown type when provided", () => {
			expect(getCourseTypeDisplay("UNKNOWN_TYPE", "Custom Label")).toBe(
				"Custom Label",
			);
		});

		it("should return original value for unknown type without fallback", () => {
			expect(getCourseTypeDisplay("UNKNOWN_TYPE")).toBe("UNKNOWN_TYPE");
		});
	});

	describe("getExamTypeDisplay", () => {
		it.each([
			["EXAM", "Іспит"],
			["CREDIT", "Залік"],
			["exam", "Іспит"],
		])("maps %s to a Ukrainian control-form label", (type, expected) => {
			expect(getExamTypeDisplay(type)).toBe(expected);
		});

		it("passes unknown values through without a fallback", () => {
			expect(getExamTypeDisplay("OFFSET")).toBe("OFFSET");
		});

		it("returns an empty label for a missing value", () => {
			expect(getExamTypeDisplay(null)).toBe("");
			expect(getExamTypeDisplay(undefined)).toBe("");
		});
	});

	describe("getSemesterTermDisplay", () => {
		it.each([
			["FALL", "Осінь"],
			["SPRING", "Весна"],
			["SUMMER", "Літо"],
			["fall", "Осінь"], // lowercase handling
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
			// Arrange
			const year = 2024;
			const term = "FALL";

			// Act
			const result = getSemesterDisplay(year, term);

			// Assert
			expect(result).toBe("Осінь 2024");
		});

		it("should use fallback when term is unknown", () => {
			// Arrange
			const year = 2024;
			const unknownTerm = "UNKNOWN";
			const fallback = "Невідомо";

			// Act
			const result = getSemesterDisplay(year, unknownTerm, fallback);

			// Assert
			expect(result).toBe("Невідомо 2024");
		});
	});

	describe("getStatusLabel", () => {
		it.each([
			["PLANNED", "Заплановано"],
			["ACTIVE", "Активний"],
			["FINISHED", "Завершено"],
		])("should return Ukrainian label for %s status", (status, expected) => {
			expect(getStatusLabel(status)).toBe(expected);
		});

		it("should return original value for unknown status", () => {
			expect(getStatusLabel("UNKNOWN_STATUS")).toBe("UNKNOWN_STATUS");
		});
	});

	describe("getStatusVariant", () => {
		it.each([
			["PLANNED", "outline"],
			["ACTIVE", "default"],
			["FINISHED", "secondary"],
			["UNKNOWN_STATUS", "default"],
		])("should return correct variant for %s status", (status, expected) => {
			expect(getStatusVariant(status)).toBe(expected);
		});
	});

	describe("getTypeKindLabel", () => {
		it("should return Ukrainian label for COMPULSORY type", () => {
			expect(getTypeKindLabel("COMPULSORY")).toBe("Обов'язковий");
		});

		it("should return original value for unknown type", () => {
			expect(getTypeKindLabel("UNKNOWN_TYPE")).toBe("UNKNOWN_TYPE");
		});
	});

	describe("getTypeKindVariant", () => {
		it.each([
			["COMPULSORY", "default"],
			["ELECTIVE", "secondary"],
			["PROF_ORIENTED", "outline"],
			["UNKNOWN_TYPE", "outline"],
		])("should return correct variant for %s type", (typeKind, expected) => {
			expect(getTypeKindVariant(typeKind)).toBe(expected);
		});
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
