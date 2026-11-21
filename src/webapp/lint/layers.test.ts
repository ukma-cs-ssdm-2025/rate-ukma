import { describe, expect, it } from "vitest";

import { forbid } from "./layers.ts";

function relativePattern(paths: string[]): RegExp {
	const pattern = forbid(paths, "")[1]?.regex;
	if (pattern === undefined) {
		throw new Error("forbid() returns no relative pattern");
	}
	return new RegExp(pattern);
}

describe("forbid", () => {
	it("catches every relative spelling of a forbidden folder", () => {
		const generated = relativePattern(["lib/api/generated"]);
		expect(generated.test("../lib/api/generated")).toBe(true);
		expect(generated.test("../lib/api/generated/models")).toBe(true);
		expect(generated.test("../../api/generated")).toBe(true);
		expect(generated.test("../generated")).toBe(true);

		const ratings = relativePattern(["features/ratings"]);
		expect(ratings.test("../../ratings/definitions/ratingDefinitions")).toBe(
			true,
		);
		expect(ratings.test("../../../features/ratings/hooks/useRating")).toBe(
			true,
		);
	});

	it("leaves sibling and same-folder imports alone", () => {
		const ratings = relativePattern(["features/ratings"]);
		expect(ratings.test("./ratings")).toBe(false);
		expect(ratings.test("../components/RatingCard")).toBe(false);
		expect(ratings.test("../ratingsFormatting")).toBe(false);
	});
});
