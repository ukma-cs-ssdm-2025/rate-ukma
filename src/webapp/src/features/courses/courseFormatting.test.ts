import { describe, expect, it } from "vitest";

import {
	DIFFICULTY_RANGE,
	formatDate,
	formatDecimalValue,
	getCourseTypeDisplay,
	getDifficultyTone,
	getFacultyAbbreviation,
	getSemesterDisplay,
	getSemesterTermDisplay,
	getStatusLabel,
	getStatusVariant,
	getTypeKindLabel,
	getTypeKindVariant,
	getUsefulnessTone,
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
			DESTRUCTIVE:
				"text-[var(--destructive)] dark:text-[var(--destructive-foreground)]",
			MEDIUM: "text-[var(--chart-5)] dark:text-[var(--chart-5)]",
			PRIMARY: "text-[var(--primary)]",
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
			PRIMARY: "text-[var(--primary)]",
			MEDIUM: "text-[var(--chart-2)] dark:text-[var(--chart-2)]",
			LOW: "text-[var(--muted-foreground)]",
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
			["PROF_ORIENTED", "Професійно орієнтований"],
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
		it("should combine year and term into display string", () => {
			// Arrange
			const year = 2024;
			const term = "FALL";

			// Act
			const result = getSemesterDisplay(year, term);

			// Assert
			expect(result).toBe("2024 Осінь");
		});

		it("should use fallback when term is unknown", () => {
			// Arrange
			const year = 2024;
			const unknownTerm = "UNKNOWN";
			const fallback = "Невідомо";

			// Act
			const result = getSemesterDisplay(year, unknownTerm, fallback);

			// Assert
			expect(result).toBe("2024 Невідомо");
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
});
