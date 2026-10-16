import { assert, describe, it } from "@effect/vitest";
import { planUnits } from "./units.ts";

const STORED = [
	{ id: "fac_1", name: "Факультет уявних наук", sazFilterId: "901" },
	{ id: "fac_2", name: "Факультет вигаданих мистецтв", sazFilterId: null },
];

describe("planUnits", () => {
	it("keeps the row of a unit САЗ renamed, by its filter id", () => {
		assert.deepStrictEqual(
			planUnits(STORED, [
				{ name: "Факультет уявних та вигаданих наук", sazFilterId: "901" },
			]),
			{
				updates: [
					{
						id: "fac_1",
						name: "Факультет уявних та вигаданих наук",
						sazFilterId: "901",
					},
				],
				inserts: [],
			},
		);
	});

	it("falls back to the name, and a row without an id takes the new one", () => {
		assert.deepStrictEqual(
			planUnits(STORED, [
				{ name: "Факультет вигаданих мистецтв", sazFilterId: "902" },
				{ name: "Факультет уявних наук", sazFilterId: null },
			]).updates,
			[
				{
					id: "fac_2",
					name: "Факультет вигаданих мистецтв",
					sazFilterId: "902",
				},
				{ id: "fac_1", name: "Факультет уявних наук", sazFilterId: "901" },
			],
		);
	});

	it("adds a new unit, and one whose name matches a row of another id", () => {
		assert.deepStrictEqual(
			planUnits(STORED, [
				{ name: "Факультет нових наук", sazFilterId: "903" },
				{ name: "Факультет уявних наук", sazFilterId: "904" },
			]).inserts,
			[
				{ name: "Факультет нових наук", sazFilterId: "903" },
				{ name: "Факультет уявних наук", sazFilterId: "904" },
			],
		);
	});
});
