import { describe, expect, it } from "vitest";

import { type FeedItem, isPromoItem, orderFeedItems } from "./feedTypes";

function review(id: string, pinned?: boolean): FeedItem {
	return {
		kind: "review",
		id,
		createdAt: "2025-01-01T00:00:00.000Z",
		pinned,
		courseId: `course-${id}`,
		courseTitle: `Course ${id}`,
		studentName: "Student",
		isAnonymous: false,
		difficulty: 3,
		usefulness: 3,
	};
}

function promo(id: string, pinned?: boolean): FeedItem {
	return {
		kind: "promo",
		id,
		createdAt: "2025-01-01T00:00:00.000Z",
		pinned,
		title: `Promo ${id}`,
		body: "body",
	};
}

describe("orderFeedItems", () => {
	it("moves pinned items to the front", () => {
		const items = [
			review("1"),
			promo("2", true),
			review("3"),
			promo("4", true),
		];

		expect(orderFeedItems(items).map((i) => i.id)).toEqual([
			"2",
			"4",
			"1",
			"3",
		]);
	});

	it("keeps relative order stable within the pinned and unpinned groups", () => {
		const items = [
			review("a"),
			review("b", true),
			review("c"),
			review("d", true),
		];

		expect(orderFeedItems(items).map((i) => i.id)).toEqual([
			"b",
			"d",
			"a",
			"c",
		]);
	});

	it("treats a missing pinned flag as not pinned", () => {
		const items = [review("1"), promo("2", true)];

		expect(orderFeedItems(items).map((i) => i.id)).toEqual(["2", "1"]);
	});

	it("returns a new array without mutating the input", () => {
		const items = [review("1"), promo("2", true)];
		const ordered = orderFeedItems(items);

		expect(ordered).not.toBe(items);
		expect(items.map((i) => i.id)).toEqual(["1", "2"]);
	});
});

describe("isPromoItem", () => {
	it("distinguishes promo items from reviews", () => {
		expect(isPromoItem(promo("1"))).toBe(true);
		expect(isPromoItem(review("1"))).toBe(false);
	});
});
