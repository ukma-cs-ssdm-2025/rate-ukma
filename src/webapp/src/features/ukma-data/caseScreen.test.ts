import { describe, expect, it } from "vitest";

import { caseMeanwhile, caseSides } from "./caseScreen";
import { removalCase } from "./components/caseTestData";

const rowLabels = (status: "open" | "decided") =>
	caseSides({ ...removalCase, status }).flatMap((side) =>
		side.rows.map(([label]) => label),
	);

describe("case screen", () => {
	it("shows the interim state as current only while a case is open", () => {
		// Assert
		expect(rowLabels("open")).toContain("Стан");
		expect(rowLabels("decided")).not.toContain("Стан");
		expect(rowLabels("decided")).toContain("Поки справа була відкрита");
	});

	it("does not claim a decided case's outcome is the interim state", () => {
		// Act
		const text = caseMeanwhile({ ...removalCase, status: "decided" });

		// Assert
		expect(text).toBe(
			"Справу вирішено в сервісі даних САЗ; вище — що показували, поки вона була відкрита.",
		);
	});
});
