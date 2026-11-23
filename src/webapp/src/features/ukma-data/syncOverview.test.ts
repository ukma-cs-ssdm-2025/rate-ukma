import { describe, expect, it } from "vitest";

import { approval, rejection, summary } from "./components/dataTestData";
import { timeAgo } from "./syncFormat";
import {
	approvalCounts,
	approvalTerm,
	approverName,
	groupCounts,
	kindParts,
	skippedReasons,
} from "./syncOverview";

const NOW = Date.parse("2030-09-10T12:00:00Z");

describe("groupCounts", () => {
	it("sums the review steps into the five groups, in reading order", () => {
		const groups = groupCounts(summary);

		expect(
			groups.map((group) => [group.group, group.count, group.rated]),
		).toEqual([
			["new", 812, 0],
			["link", 301, 0],
			["change", 150, 4],
			["mapping", 18, 3],
			["removed", 3, 0],
		]);
		expect(groups[3]?.kinds).toEqual({ merge_courses: 15, place_offering: 3 });
	});
});

describe("kindParts", () => {
	it("names each kind in plain words, largest first", () => {
		expect(kindParts({ new_course: 40, new_offering: 772 })).toBe(
			"курси в семестрі 772, курси 40",
		);
	});
});

describe("skippedReasons", () => {
	it("lists why rows were not proposed, largest first", () => {
		expect(skippedReasons(summary)).toEqual([
			{ label: "Немає семестру", count: 5 },
			{ label: "Нуль кредитів", count: 2 },
		]);
	});
});

describe("approval words", () => {
	it("calls an apply «застосовано» and a reject «відхилено»", () => {
		expect(approvalTerm(approval)).toBe("applied");
		expect(approvalTerm(rejection)).toBe("rejected");
		expect(approvalTerm({ ...approval, outcome: "refused" })).toBeNull();
	});

	it("calls a revert «відкочено» and counts what it put back", () => {
		const revert = {
			...approval,
			action: "revert" as const,
			counts: { reverted: 3 },
		};

		expect(approvalTerm(revert)).toBe("reverted");
		expect(approvalCounts(revert.counts).reverted).toBe(3);
	});

	it("names the approver by the email's local part, or auto", () => {
		expect(approverName("o.testenko@ukma.edu.ua")).toBe("o.testenko");
		expect(approverName(null)).toBe("авто");
	});
});

describe("timeAgo", () => {
	it.each([
		["2030-09-10T11:59:40Z", "щойно"],
		["2030-09-10T11:20:00Z", "40 хв тому"],
		["2030-09-10T09:00:00Z", "3 год тому"],
		["2030-09-07T12:00:00Z", "3 дні тому"],
		["2030-09-15T12:00:00Z", "через 5 днів"],
	])("reads %s as «%s»", (iso, expected) => {
		expect(timeAgo(iso, NOW)).toBe(expected);
	});
});
