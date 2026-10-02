import { describe, expect, it } from "vitest";

import { coursesNoun } from "./plural";

describe("coursesNoun", () => {
	it.each([
		[1, "курс"],
		[2, "курси"],
		[4, "курси"],
		[5, "курсів"],
		[11, "курсів"],
		[12, "курсів"],
		[21, "курс"],
		[22, "курси"],
		[111, "курсів"],
	])("%i → %s", (count, noun) => {
		expect(coursesNoun(count)).toBe(noun);
	});
});
