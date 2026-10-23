import { assert, describe, it } from "@effect/vitest";
import { migrations } from "./database.ts";

describe("migrations", () => {
	it("numbers every migration once, in the order listed", () => {
		const keys = Object.keys(migrations);

		const numbers = keys.map((key) => {
			const number = /^(\d{4})_[a-z0-9_]+$/.exec(key)?.[1];

			assert.isDefined(number, `${key} is not named <4 digits>_<name>`);

			return Number(number);
		});

		assert.deepStrictEqual(
			numbers,
			[...new Set(numbers)].sort((a, b) => a - b),
			`migration numbers repeat or are out of order: ${keys.join(", ")}`,
		);
	});
});
