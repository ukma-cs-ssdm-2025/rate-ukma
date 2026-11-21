import { describe, expect, it } from "vitest";

import { getSemesterDisplay, getSemesterTermDisplay } from "./semester-term";

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
