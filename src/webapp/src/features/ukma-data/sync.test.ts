import { describe, expect, it } from "vitest";

import { countsSummary } from "./sync";

describe("countsSummary", () => {
	it("names kinds and states in words and leaves out the skip keys", () => {
		expect(
			countsSummary({
				new_course: 40,
				change_course: { proposed: 3 },
				skipped: { no_term: 5 },
			}),
		).toEqual(["Нова дисципліна: 40", "Зміна дисципліни, чекає: 3"]);
	});
});
