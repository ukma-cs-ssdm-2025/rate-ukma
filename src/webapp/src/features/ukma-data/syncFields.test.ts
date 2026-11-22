import { describe, expect, it } from "vitest";

import { catalogGroups } from "./components/syncTestData";
import {
	blankTitle,
	changePair,
	fieldLabel,
	fieldLines,
	valueText,
} from "./syncFields";

describe("syncFields", () => {
	it("labels fields and values in plain words", () => {
		// Assert
		expect(fieldLabel("practice_type")).toBe("Тип практичних занять");
		expect(fieldLabel("mystery")).toBe("mystery");
		expect(valueText("practice_type", "SEMINAR")).toBe("семінар");
		expect(valueText("credits", "2.5")).toBe("2,5");
		expect(valueText("term", "FALL")).toBe("Осінь");
		expect(valueText("exam_type", "")).toBe("не вказано");
		expect(blankTitle("practice_type")).toBe(
			"САЗ більше не вказує тип практичних",
		);
	});

	it("puts each blanking row right after its field", () => {
		// Act
		const lines = fieldLines(
			catalogGroups.changes.by_field,
			catalogGroups.changes.blanking,
		);

		// Assert
		expect(lines.map((line) => [line.row.field, line.blanking])).toEqual([
			["practice_type", false],
			["practice_type", true],
			["credits", false],
			["term", false],
		]);
	});

	it("keeps a blanking row with no field row at the end", () => {
		// Arrange
		const blank = { field: "exam_type", count: 2, pairs: [] };

		// Act
		const lines = fieldLines([], [blank]);

		// Assert
		expect(lines).toEqual([{ row: blank, blanking: true }]);
	});

	it("reads one field's pair from a change", () => {
		// Act
		const pair = changePair(
			"credits",
			{ terms: [{ year: 2030, term: "FALL", credits: 4 }] },
			{ terms: [{ year: 2030, term: "FALL", credits: 3 }] },
		);

		// Assert
		expect(pair).toEqual({ before: "3", after: "4" });
	});
});
