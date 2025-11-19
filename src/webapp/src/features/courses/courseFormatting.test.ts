import { describe, expect, it } from "vitest";

import {
	DIFFICULTY_RANGE,
	formatDate,
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
		it("should return destructive tone for high difficulty (>= 4)", () => {
			// Arrange
			const highDifficulty = 4.5;

			// Act
			const result = getDifficultyTone(highDifficulty);

			// Assert
			expect(result).toBe(
				"text-[var(--destructive)] dark:text-[var(--destructive-foreground)]",
			);
		});

		it("should return chart-5 tone for medium difficulty (>= 3)", () => {
			// Arrange
			const mediumDifficulty = 3.2;

			// Act
			const result = getDifficultyTone(mediumDifficulty);

			// Assert
			expect(result).toBe("text-[var(--chart-5)] dark:text-[var(--chart-5)]");
		});

		it("should return primary tone for low difficulty (< 3)", () => {
			// Arrange
			const lowDifficulty = 2.1;

			// Act
			const result = getDifficultyTone(lowDifficulty);

			// Assert
			expect(result).toBe(
				"text-[var(--primary)] dark:text-[var(--primary-foreground)]",
			);
		});

		it("should return muted tone for null value", () => {
			// Arrange
			const nullValue = null;

			// Act
			const result = getDifficultyTone(nullValue);

			// Assert
			expect(result).toBe("text-muted-foreground");
		});

		it("should return muted tone for undefined value", () => {
			// Arrange
			const undefinedValue = undefined;

			// Act
			const result = getDifficultyTone(undefinedValue);

			// Assert
			expect(result).toBe("text-muted-foreground");
		});

		it("should return muted tone for zero value", () => {
			// Arrange
			const zeroValue = 0;

			// Act
			const result = getDifficultyTone(zeroValue);

			// Assert
			expect(result).toBe("text-muted-foreground");
		});

		it("should handle exact boundary value 4", () => {
			// Arrange
			const exactFour = 4.0;

			// Act
			const result = getDifficultyTone(exactFour);

			// Assert
			expect(result).toBe(
				"text-[var(--destructive)] dark:text-[var(--destructive-foreground)]",
			);
		});

		it("should handle exact boundary value 3", () => {
			// Arrange
			const exactThree = 3.0;

			// Act
			const result = getDifficultyTone(exactThree);

			// Assert
			expect(result).toBe("text-[var(--chart-5)] dark:text-[var(--chart-5)]");
		});
	});

	describe("getUsefulnessTone", () => {
		it("should return primary tone for high usefulness (>= 4)", () => {
			// Arrange
			const highUsefulness = 4.5;

			// Act
			const result = getUsefulnessTone(highUsefulness);

			// Assert
			expect(result).toBe(
				"text-[var(--primary)] dark:text-[var(--primary-foreground)]",
			);
		});

		it("should return chart-2 tone for medium usefulness (>= 3)", () => {
			// Arrange
			const mediumUsefulness = 3.2;

			// Act
			const result = getUsefulnessTone(mediumUsefulness);

			// Assert
			expect(result).toBe("text-[var(--chart-2)] dark:text-[var(--chart-2)]");
		});

		it("should return muted tone for low usefulness (< 3)", () => {
			// Arrange
			const lowUsefulness = 2.1;

			// Act
			const result = getUsefulnessTone(lowUsefulness);

			// Assert
			expect(result).toBe("text-[var(--muted-foreground)]");
		});

		it("should return muted tone for null value", () => {
			// Arrange
			const nullValue = null;

			// Act
			const result = getUsefulnessTone(nullValue);

			// Assert
			expect(result).toBe("text-muted-foreground");
		});

		it("should return muted tone for undefined value", () => {
			// Arrange
			const undefinedValue = undefined;

			// Act
			const result = getUsefulnessTone(undefinedValue);

			// Assert
			expect(result).toBe("text-muted-foreground");
		});
	});

	describe("getCourseTypeDisplay", () => {
		it("should return Ukrainian label for COMPULSORY type", () => {
			// Arrange
			const type = "COMPULSORY";

			// Act
			const result = getCourseTypeDisplay(type);

			// Assert
			expect(result).toBe("Обов'язковий");
		});

		it("should return Ukrainian label for ELECTIVE type", () => {
			// Arrange
			const type = "ELECTIVE";

			// Act
			const result = getCourseTypeDisplay(type);

			// Assert
			expect(result).toBe("Вибірковий");
		});

		it("should return Ukrainian label for PROF_ORIENTED type", () => {
			// Arrange
			const type = "PROF_ORIENTED";

			// Act
			const result = getCourseTypeDisplay(type);

			// Assert
			expect(result).toBe("Професійно орієнтований");
		});

		it("should return fallback for unknown type when provided", () => {
			// Arrange
			const unknownType = "UNKNOWN_TYPE";
			const fallback = "Custom Label";

			// Act
			const result = getCourseTypeDisplay(unknownType, fallback);

			// Assert
			expect(result).toBe("Custom Label");
		});

		it("should return original value for unknown type without fallback", () => {
			// Arrange
			const unknownType = "UNKNOWN_TYPE";

			// Act
			const result = getCourseTypeDisplay(unknownType);

			// Assert
			expect(result).toBe("UNKNOWN_TYPE");
		});
	});

	describe("getSemesterTermDisplay", () => {
		it("should return Ukrainian label for FALL term", () => {
			// Arrange
			const term = "FALL";

			// Act
			const result = getSemesterTermDisplay(term);

			// Assert
			expect(result).toBe("Осінь");
		});

		it("should return Ukrainian label for SPRING term", () => {
			// Arrange
			const term = "SPRING";

			// Act
			const result = getSemesterTermDisplay(term);

			// Assert
			expect(result).toBe("Весна");
		});

		it("should return Ukrainian label for SUMMER term", () => {
			// Arrange
			const term = "SUMMER";

			// Act
			const result = getSemesterTermDisplay(term);

			// Assert
			expect(result).toBe("Літо");
		});

		it("should handle lowercase term by converting to uppercase", () => {
			// Arrange
			const lowercaseTerm = "fall";

			// Act
			const result = getSemesterTermDisplay(lowercaseTerm);

			// Assert
			expect(result).toBe("Осінь");
		});

		it("should return fallback for unknown term when provided", () => {
			// Arrange
			const unknownTerm = "WINTER";
			const fallback = "Зима";

			// Act
			const result = getSemesterTermDisplay(unknownTerm, fallback);

			// Assert
			expect(result).toBe("Зима");
		});

		it("should return original value for unknown term without fallback", () => {
			// Arrange
			const unknownTerm = "WINTER";

			// Act
			const result = getSemesterTermDisplay(unknownTerm);

			// Assert
			expect(result).toBe("WINTER");
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
		it("should return Ukrainian label for PLANNED status", () => {
			// Arrange
			const status = "PLANNED";

			// Act
			const result = getStatusLabel(status);

			// Assert
			expect(result).toBe("Заплановано");
		});

		it("should return Ukrainian label for ACTIVE status", () => {
			// Arrange
			const status = "ACTIVE";

			// Act
			const result = getStatusLabel(status);

			// Assert
			expect(result).toBe("Активний");
		});

		it("should return Ukrainian label for FINISHED status", () => {
			// Arrange
			const status = "FINISHED";

			// Act
			const result = getStatusLabel(status);

			// Assert
			expect(result).toBe("Завершено");
		});

		it("should return original value for unknown status", () => {
			// Arrange
			const unknownStatus = "UNKNOWN_STATUS";

			// Act
			const result = getStatusLabel(unknownStatus);

			// Assert
			expect(result).toBe("UNKNOWN_STATUS");
		});
	});

	describe("getStatusVariant", () => {
		it("should return outline variant for PLANNED status", () => {
			// Arrange
			const status = "PLANNED";

			// Act
			const result = getStatusVariant(status);

			// Assert
			expect(result).toBe("outline");
		});

		it("should return default variant for ACTIVE status", () => {
			// Arrange
			const status = "ACTIVE";

			// Act
			const result = getStatusVariant(status);

			// Assert
			expect(result).toBe("default");
		});

		it("should return secondary variant for FINISHED status", () => {
			// Arrange
			const status = "FINISHED";

			// Act
			const result = getStatusVariant(status);

			// Assert
			expect(result).toBe("secondary");
		});

		it("should return default variant for unknown status", () => {
			// Arrange
			const unknownStatus = "UNKNOWN_STATUS";

			// Act
			const result = getStatusVariant(unknownStatus);

			// Assert
			expect(result).toBe("default");
		});
	});

	describe("getTypeKindLabel", () => {
		it("should return Ukrainian label for COMPULSORY type", () => {
			// Arrange
			const typeKind = "COMPULSORY";

			// Act
			const result = getTypeKindLabel(typeKind);

			// Assert
			expect(result).toBe("Обов'язковий");
		});

		it("should return original value for unknown type", () => {
			// Arrange
			const unknownType = "UNKNOWN_TYPE";

			// Act
			const result = getTypeKindLabel(unknownType);

			// Assert
			expect(result).toBe("UNKNOWN_TYPE");
		});
	});

	describe("getTypeKindVariant", () => {
		it("should return default variant for COMPULSORY type", () => {
			// Arrange
			const typeKind = "COMPULSORY";

			// Act
			const result = getTypeKindVariant(typeKind);

			// Assert
			expect(result).toBe("default");
		});

		it("should return secondary variant for ELECTIVE type", () => {
			// Arrange
			const typeKind = "ELECTIVE";

			// Act
			const result = getTypeKindVariant(typeKind);

			// Assert
			expect(result).toBe("secondary");
		});

		it("should return outline variant for PROF_ORIENTED type", () => {
			// Arrange
			const typeKind = "PROF_ORIENTED";

			// Act
			const result = getTypeKindVariant(typeKind);

			// Assert
			expect(result).toBe("outline");
		});

		it("should return outline variant for unknown type", () => {
			// Arrange
			const unknownType = "UNKNOWN_TYPE";

			// Act
			const result = getTypeKindVariant(unknownType);

			// Assert
			expect(result).toBe("outline");
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
});
