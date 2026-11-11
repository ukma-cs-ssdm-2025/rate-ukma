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
				released: [],
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

	it("matches by name first, so the filter id follows the name", () => {
		assert.deepStrictEqual(
			planUnits(STORED, [
				{ name: "Факультет уявних наук", sazFilterId: "904" },
				{ name: "Факультет вигаданих мистецтв", sazFilterId: null },
			]),
			{
				released: [],
				updates: [
					{ id: "fac_1", name: "Факультет уявних наук", sazFilterId: "904" },
					{
						id: "fac_2",
						name: "Факультет вигаданих мистецтв",
						sazFilterId: null,
					},
				],
				inserts: [],
			},
		);
	});

	it("moves a filter id to the row whose name now carries it", () => {
		assert.deepStrictEqual(
			planUnits(STORED, [
				{ name: "Факультет вигаданих мистецтв", sazFilterId: "901" },
			]),
			{
				released: ["fac_1"],
				updates: [
					{
						id: "fac_2",
						name: "Факультет вигаданих мистецтв",
						sazFilterId: "901",
					},
				],
				inserts: [],
			},
		);
	});

	it("gives a renamed unit's filter id to its new name, not its old one", () => {
		assert.deepStrictEqual(
			planUnits(STORED, [
				{ name: "Факультет уявних наук", sazFilterId: null },
				{ name: "Факультет уявних та вигаданих наук", sazFilterId: "901" },
			]),
			{
				released: [],
				updates: [
					{ id: "fac_1", name: "Факультет уявних наук", sazFilterId: null },
				],
				inserts: [
					{ name: "Факультет уявних та вигаданих наук", sazFilterId: "901" },
				],
			},
		);
	});

	it("adds a unit no row matches", () => {
		assert.deepStrictEqual(
			planUnits(STORED, [{ name: "Факультет нових наук", sazFilterId: "903" }])
				.inserts,
			[{ name: "Факультет нових наук", sazFilterId: "903" }],
		);
	});
});
