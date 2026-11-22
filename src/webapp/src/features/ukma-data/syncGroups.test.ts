import { describe, expect, it } from "vitest";

import {
	appliedApproval,
	catalogGroups,
	doneGroups,
} from "./components/syncTestData";
import {
	approvalGroup,
	doneLines,
	linkParts,
	openLines,
	partsPhrase,
	partsTotal,
	pendingTotal,
	whoDid,
} from "./syncGroups";

describe("openLines", () => {
	it("lists the open groups in the v3 order with their counts", () => {
		// Act
		const lines = openLines(catalogGroups);

		// Assert
		expect(lines.map((line) => [line.key, line.count])).toEqual([
			["links", 29_457],
			["new", 863],
			["changes", 1855],
			["merges", 185],
			["placements", 28],
		]);
	});

	it("names every part of the safe group in its title and button", () => {
		// Act
		const [links] = openLines(catalogGroups);

		// Assert
		expect(links?.title).toBe(
			"5 116 дисциплін, 24 290 семестрів і 51 факультет чи кафедра — ті самі, що в САЗ",
		);
		expect(links?.action).toEqual({
			label: "Підтвердити всі 29 457",
			view: null,
		});
		expect(links?.chip).toBe("safe");
	});

	it("sends rated pairs to the desk and links the unrated ones", () => {
		// Act
		const merges = openLines(catalogGroups).find(
			(line) => line.key === "merges",
		);

		// Assert
		expect(merges?.chip).toBe("ratings");
		expect(merges?.action.view).toBe("merge");
		expect(merges?.link).toEqual({
			label: "Пари без оцінок (175)",
			view: "pairs",
		});
	});

	it("counts what is left to decide", () => {
		// Assert
		expect(pendingTotal(catalogGroups)).toBe(29_457 + 863 + 1855 + 185 + 28);
		expect(pendingTotal(doneGroups)).toBe(0);
		expect(openLines(doneGroups)).toEqual([]);
	});
});

describe("parts", () => {
	it("totals and phrases the link parts", () => {
		// Act
		const parts = linkParts(catalogGroups);

		// Assert
		expect(partsTotal(parts)).toBe(29_457);
		expect(partsPhrase(parts)).toBe(
			"5 116 дисциплін, 24 290 семестрів, 51 факультет чи кафедра",
		);
	});
});

describe("doneLines", () => {
	it("moves an applied group that has nothing left to the done list", () => {
		// Arrange
		const now = new Date("2030-09-01T12:00:00Z");

		// Act
		const done = doneLines(
			doneGroups,
			[appliedApproval],
			"reviewer@example.invalid",
			now,
		);

		// Assert
		expect(done).toHaveLength(1);
		expect(done[0]?.key).toBe("links");
		expect(done[0]?.detail).toMatch(/^Ви, сьогодні о /);
		expect(done[0]?.runId).toBe(7);
	});

	it("keeps a group that is still open out of the done list", () => {
		// Assert
		expect(doneLines(catalogGroups, [appliedApproval], null)).toEqual([]);
	});

	it("maps approvals to groups and names who applied them", () => {
		// Assert
		expect(approvalGroup({ group: "mapping", kind: "merge_courses" })).toBe(
			"merges",
		);
		expect(approvalGroup({ group: "mapping", kind: "place_offering" })).toBe(
			"placements",
		);
		expect(approvalGroup({ group: "unknown", kind: "" })).toBeNull();
		expect(whoDid(null, "a@example.invalid")).toBe("Нічний запуск");
		expect(whoDid("b@example.invalid", "a@example.invalid")).toBe(
			"b@example.invalid",
		);
	});
});
