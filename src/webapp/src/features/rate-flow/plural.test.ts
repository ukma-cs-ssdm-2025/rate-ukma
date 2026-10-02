import { describe, expect, it } from "vitest";

import { coursesNoun } from "./plural";

describe("coursesNoun", () => {
	it.each([
		[1, "дисципліна"],
		[2, "дисципліни"],
		[4, "дисципліни"],
		[5, "дисциплін"],
		[11, "дисциплін"],
		[12, "дисциплін"],
		[21, "дисципліна"],
		[22, "дисципліни"],
		[111, "дисциплін"],
	])("%i → %s", (count, noun) => {
		expect(coursesNoun(count)).toBe(noun);
	});
});
