import { describe, expect, it } from "vitest";

import { orderByPopularity, popularityScore } from "./ratingPopularity";

describe("popularityScore", () => {
	it("ranks downvote-only reviews below unvoted ones", () => {
		expect(popularityScore(0, 2)).toBeLessThan(popularityScore(0, 0));
	});

	it("ranks many consistent upvotes above a single one", () => {
		expect(popularityScore(10, 0)).toBeGreaterThan(popularityScore(1, 0));
	});
});

describe("orderByPopularity", () => {
	const ratings = [
		{ id: "a", upvotes: 2, downvotes: 0 },
		{ id: "b", upvotes: 1, downvotes: 0 },
		{ id: "c", upvotes: 0, downvotes: 0 },
		{ id: "d", upvotes: 0, downvotes: 0 },
	];

	it("moves a review up once a local vote overtakes the one above", () => {
		const ordered = orderByPopularity(ratings, {
			b: { upvotes: 3, downvotes: 0 },
		});
		expect(ordered.map((r) => r.id)).toEqual(["b", "a", "c", "d"]);
	});

	it("keeps the server order for ties", () => {
		expect(orderByPopularity(ratings, {}).map((r) => r.id)).toEqual([
			"a",
			"b",
			"c",
			"d",
		]);
	});
});
