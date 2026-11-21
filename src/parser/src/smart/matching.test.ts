import { assert, describe, it } from "@effect/vitest";
import {
	departmentKey,
	type MatchDiscipline,
	type MatchOffering,
	matchTeachers,
	normalisedTitle,
} from "./matching.ts";

const offering = (overrides: Partial<MatchOffering> = {}): MatchOffering => ({
	id: "off_1",
	title: "Уявні алгоритми та структури",
	credits: 4,
	departmentName: "Кафедра вигаданих систем",
	level: "bachelor",
	sazTeachers: null,
	...overrides,
});

const discipline = (
	teachers: MatchDiscipline["teachers"],
	overrides: Partial<MatchDiscipline> = {},
): MatchDiscipline => ({
	title: "«Уявні алгоритми і структури»",
	credits: 4,
	departmentName: "КАФЕДРА ВИГАДАНИХ СИСТЕМ",
	level: "bachelor",
	teachers,
	...overrides,
});

const teachers = [
	{ smartId: 1, lastName: "Вигаданенко" },
	{ smartId: 2, lastName: "Зразковий" },
	{ smartId: 3, lastName: "Уявна" },
];

const lecturer = (smartId: number) => ({ smartId, role: "LECTURER" as const });

describe("normalisedTitle", () => {
	it("ignores case, quotes, dashes, punctuation and та/й/і/и", () => {
		assert.strictEqual(
			normalisedTitle(" «Уявні – алгоритми, та   структури» "),
			normalisedTitle("уявні алгоритми і структури"),
		);
	});

	it("maps the schools САЗ and smart.ukma name differently", () => {
		assert.strictEqual(
			departmentKey(
				'Кафедра "Школа соціальної роботи імені професора В. І. Полтавця"',
			),
			departmentKey(
				"Школа соціальної роботи імені професора Володимира Полтавця",
			),
		);
		assert.strictEqual(
			departmentKey("Могилянська школа журналістики"),
			departmentKey("Кафедра «Могилянська школа журналістики»"),
		);
		assert.strictEqual(
			departmentKey('Кафедра "Школа громадського здоров`я"'),
			departmentKey("Школа громадського здоров’я "),
		);
	});

	it("keeps a department's own name apart from an імені suffix", () => {
		assert.strictEqual(
			departmentKey("Кафедра уявної фізики імені Вигаданого"),
			departmentKey("кафедра уявної фізики"),
		);
	});
});

describe("matchTeachers", () => {
	it("links the one teacher set every matching discipline names", () => {
		const { links, report } = matchTeachers(
			[offering()],
			[
				discipline([lecturer(1), { smartId: 2, role: "PRACTICE_TEACHER" }]),
				discipline([{ smartId: 1, role: "PRACTICE_TEACHER" }, lecturer(2)]),
			],
			teachers,
		);

		assert.deepStrictEqual(links, [
			{
				offeringId: "off_1",
				smartId: 1,
				role: "LECTURER_AND_PRACTICE_TEACHER",
			},
			{
				offeringId: "off_1",
				smartId: 2,
				role: "LECTURER_AND_PRACTICE_TEACHER",
			},
		]);
		assert.strictEqual(report.linked, 1);
	});

	it("needs credits, department and level to match", () => {
		const { links } = matchTeachers(
			[
				offering({ id: "off_credits", credits: 5 }),
				offering({ id: "off_department", departmentName: "Інша кафедра" }),
				offering({ id: "off_level", level: "master" }),
				offering({ id: "off_none", departmentName: null }),
			],
			[discipline([lecturer(1)])],
			teachers,
		);

		assert.deepStrictEqual(links, []);
	});

	it("lets САЗ text break a tie, and leaves a tie it cannot break", () => {
		const { links, report } = matchTeachers(
			[
				offering({ id: "off_named", sazTeachers: "доц. Зразковий Т." }),
				offering({ id: "off_silent" }),
			],
			[discipline([lecturer(1)]), discipline([lecturer(2)])],
			teachers,
		);

		assert.deepStrictEqual(links, [
			{ offeringId: "off_named", smartId: 2, role: "LECTURER" },
		]);
		assert.strictEqual(report.tieBrokenBySaz, 1);
		assert.strictEqual(report.tieLeft, 1);
	});

	it("leaves a set САЗ contradicts unlinked", () => {
		const { links, report } = matchTeachers(
			[offering({ sazTeachers: "Уявна О." })],
			[discipline([lecturer(1)])],
			teachers,
		);

		assert.deepStrictEqual(links, []);
		assert.strictEqual(report.sazDisagrees, 1);
	});

	it("keeps a set when САЗ names one of its teachers or nobody smart.ukma knows", () => {
		const { links } = matchTeachers(
			[
				offering({ id: "off_agrees", sazTeachers: "Вигаданенко М." }),
				offering({ id: "off_unknown", sazTeachers: "Сторонній П." }),
			],
			[discipline([lecturer(1)])],
			teachers,
		);

		assert.deepStrictEqual(
			links.map(({ offeringId }) => offeringId),
			["off_agrees", "off_unknown"],
		);
	});

	it("never reads a teacher missing from the list as named by САЗ", () => {
		const { links, report } = matchTeachers(
			[offering({ sazTeachers: "Уявна О." })],
			[discipline([lecturer(1), lecturer(99)])],
			teachers,
		);

		assert.deepStrictEqual(links, []);
		assert.strictEqual(report.sazDisagrees, 1);
	});

	it("reads every apostrophe in a last name as one", () => {
		const { links, report } = matchTeachers(
			[offering({ sazTeachers: "доц. Об’ємна Т." })],
			[discipline([lecturer(1)]), discipline([lecturer(5)])],
			[...teachers, { smartId: 5, lastName: "Об'ємна" }],
		);

		assert.deepStrictEqual(links, [
			{ offeringId: "off_1", smartId: 5, role: "LECTURER" },
		]);
		assert.strictEqual(report.tieBrokenBySaz, 1);
	});

	it("leaves a tie unlinked when САЗ names a last name two candidates share", () => {
		const { links, report } = matchTeachers(
			[offering({ sazTeachers: "доц. Зразковий Т." })],
			[discipline([lecturer(2)]), discipline([lecturer(4)])],
			[...teachers, { smartId: 4, lastName: "Зразковий" }],
		);

		assert.deepStrictEqual(links, []);
		assert.strictEqual(report.tieLeft, 1);
	});
});
