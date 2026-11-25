import { describe, expect, it } from "vitest";

import { wordDiff } from "./textDiff";

describe("wordDiff", () => {
	it("marks only the words that differ", () => {
		// Arrange & Act
		const diff = wordDiff(
			"Алгоритми та структури даних",
			"Алгоритми і структури даних",
		);

		// Assert
		expect(diff.before).toEqual([
			{ text: "Алгоритми ", kind: "same" },
			{ text: "та", kind: "removed" },
			{ text: " структури даних", kind: "same" },
		]);
		expect(diff.after).toEqual([
			{ text: "Алгоритми ", kind: "same" },
			{ text: "і", kind: "added" },
			{ text: " структури даних", kind: "same" },
		]);
	});

	it("keeps identical texts whole", () => {
		expect(wordDiff("Бази даних", "Бази даних").after).toEqual([
			{ text: "Бази даних", kind: "same" },
		]);
	});
});
