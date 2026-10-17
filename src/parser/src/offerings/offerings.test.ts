import { assert, describe, it } from "@effect/vitest";
import { offering } from "./offering.fixture.ts";
import { offeringRowsOf, termCode } from "./offerings.ts";

const FILTERS = {
	faculties: new Map([["Факультет вигаданих наук", "901"]]),
	departments: new Map<string, string>(),
	programmes: new Map([
		["Вигадана інженерія (Бакалавр)", "5001"],
		["Вигадана інженерія (Магістр)", "5002"],
	]),
};

describe("termCode", () => {
	it("names both calendar years and the season", () => {
		assert.strictEqual(termCode(2031, "SPRING"), "2031-32-SPRING");
	});
});

describe("offeringRowsOf", () => {
	const rows = offeringRowsOf(
		[
			{ snapshotId: 11n, offering: offering("900001") },
			{ snapshotId: 12n, offering: offering("900002", { level: "master" }) },
			{
				snapshotId: 13n,
				offering: offering("900003", {
					faculty: null,
					department: null,
					programmes: [],
					terms: [],
				}),
			},
		],
		FILTERS,
	);

	it("lists each reference row once, with its catalog filter value", () => {
		assert.deepStrictEqual(rows.faculties, [
			{ name: "Факультет вигаданих наук", sazFilterId: "901" },
		]);
		assert.deepStrictEqual(rows.departments, [
			{
				name: "Кафедра вигаданих систем",
				faculty: "Факультет вигаданих наук",
				sazFilterId: null,
			},
		]);
		assert.deepStrictEqual(rows.terms, [
			{ code: "2031-32-FALL", academicYear: 2031, season: "FALL" },
		]);
	});

	it("gives a department the faculty a card names, whatever the order", () => {
		const departments = offeringRowsOf(
			[
				{ snapshotId: 11n, offering: offering("900001") },
				{ snapshotId: 12n, offering: offering("900002", { faculty: null }) },
			],
			FILTERS,
		).departments;

		assert.deepStrictEqual(
			departments.map(({ faculty }) => faculty),
			["Факультет вигаданих наук"],
		);
	});

	it("keeps a programme name of two levels as two programmes", () => {
		assert.deepStrictEqual(rows.programmes, [
			{ name: "Вигадана інженерія", level: "bachelor", sazFilterId: "5001" },
			{ name: "Вигадана інженерія", level: "master", sazFilterId: "5002" },
		]);
		assert.deepStrictEqual(
			rows.offeringProgrammes.map(({ sazCode, level }) => [sazCode, level]),
			[
				["900001", "bachelor"],
				["900002", "master"],
			],
		);
	});

	it("takes a programme's level from the catalog when the card's level has none", () => {
		const { programmes, offeringProgrammes } = offeringRowsOf(
			[
				{
					snapshotId: 14n,
					offering: offering("900004", {
						level: "master",
						programmes: [{ name: "Уявна економіка", kind: "elective" }],
					}),
				},
			],
			{
				...FILTERS,
				programmes: new Map([["Уявна економіка (Бакалавр)", "5003"]]),
			},
		);

		assert.deepStrictEqual(programmes, [
			{ name: "Уявна економіка", level: "bachelor", sazFilterId: "5003" },
		]);
		assert.strictEqual(offeringProgrammes[0]?.level, "bachelor");
	});

	it("keeps a stored programme's level when the catalog lists neither", () => {
		const { programmes } = offeringRowsOf(
			[
				{
					snapshotId: 15n,
					offering: offering("900005", {
						level: "master",
						programmes: [{ name: "Уявна економіка", kind: "elective" }],
					}),
				},
			],
			{ ...FILTERS, programmes: new Map() },
			[{ name: "Уявна економіка", level: "bachelor" }],
		);

		assert.deepStrictEqual(programmes, [
			{ name: "Уявна економіка", level: "bachelor", sazFilterId: null },
		]);
	});

	it("keys child rows by САЗ code and term code", () => {
		assert.deepStrictEqual(
			rows.offerings.map(({ sazCode, snapshotId }) => [sazCode, snapshotId]),
			[
				["900001", "11"],
				["900002", "12"],
				["900003", "13"],
			],
		);
		assert.deepStrictEqual(
			rows.offeringTerms.map(({ sazCode, termCode: code, semesters }) => ({
				sazCode,
				code,
				semesters,
			})),
			[
				{ sazCode: "900001", code: "2031-32-FALL", semesters: [1] },
				{ sazCode: "900002", code: "2031-32-FALL", semesters: [1] },
			],
		);
	});
});
