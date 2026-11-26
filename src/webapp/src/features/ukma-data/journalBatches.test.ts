import { describe, expect, it } from "vitest";

import type { SyncJournalEntry } from "@/lib/api/generated";
import { journalItems } from "./journalBatches";

const part = (
	id: number,
	when: string,
	applied: number,
	remaining: number,
): SyncJournalEntry => ({
	id,
	kind: "apply",
	who: "admin",
	when,
	counts: { applied, remaining, skipped: 0 },
	outcome: "done",
	error: "",
	approval_id: id,
	run_id: 7,
	reverts_id: null,
	group: "change",
	revertible: true,
	revert_reason: "",
	reverted: false,
});

describe("journalItems", () => {
	it("reads the parts of one apply as one line with the total", () => {
		// Arrange
		const entries = [
			part(3, "2030-09-10T12:02:00Z", 813, 0),
			part(2, "2030-09-10T12:01:00Z", 5000, 813),
			part(1, "2030-09-10T12:00:00Z", 5000, 5813),
		];

		// Act
		const [item, ...rest] = journalItems(entries);

		// Assert
		expect(rest).toEqual([]);
		expect(item?.kind).toBe("batch");
		if (item?.kind === "batch") {
			expect(item.head.counts.applied).toBe(10_813);
			expect(item.head.counts.remaining).toBe(0);
			expect(item.head.revertible).toBe(false);
			expect(item.parts.map((entry) => entry.id)).toEqual([3, 2, 1]);
		}
	});

	it("keeps applies apart when the older one left nothing for later", () => {
		// Act
		const items = journalItems([
			part(2, "2030-09-10T12:01:00Z", 10, 0),
			part(1, "2030-09-10T12:00:00Z", 20, 0),
		]);

		// Assert
		expect(items.map((item) => item.kind)).toEqual(["one", "one"]);
	});
});
