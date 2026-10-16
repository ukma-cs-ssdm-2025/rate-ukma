import { assert, describe, it } from "@effect/vitest";
import type { ParsedOffering } from "../saz/coursePage.ts";
import { offeringRowsOf, termCode } from "./offerings.ts";

const offering = (
	sazCode: string,
	overrides: Partial<ParsedOffering> = {},
): ParsedOffering => ({
	sazCode,
	title: "Вступ до вигаданих систем",
	credits: 3,
	hours: 90,
	studyYear: 1,
	format: "2015",
	status: "held",
	isPractical: false,
	faculty: "Факультет вигаданих наук",
	department: "Кафедра вигаданих систем",
	level: "bachelor",
	academicYear: 2031,
	sazTeachers: null,
	annotation: null,
	programmes: [{ name: "Вигадана інженерія", kind: "compulsory" }],
	terms: [
		{
			season: "FALL",
			semesters: [1],
			credits: 3,
			hoursPerWeek: 2,
			lectureHours: 14,
			seminarHours: 14,
			practiceHours: null,
			control: "pass_fail",
		},
	],
	maxStudents: null,
	maxGroups: null,
	computedMaxStudents: null,
	groupSizeMin: 15,
	groupSizeMax: 30,
	enrolledActive: null,
	...overrides,
});

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
