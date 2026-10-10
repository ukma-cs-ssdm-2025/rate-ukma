/**
 * Deterministic backend mock: the hand-verified Осінь 2026–2027 КН БП-4 ground
 * truth (same facts as core/test/plan.test.ts), served instead of the real
 * parsed corpus. No network, no drift — specs assert against known constraints:
 * ІБЦС's single group narrows БПП to {3,4}; ТнВ is forced to group 3.
 */

interface FixtureRow {
	disciplineId: string;
	discipline: string;
	group: string;
	day: string;
	slot: string;
	weeks: number[];
	source: string;
	room?: string;
	teacher?: string;
	/** The printed range when it is off the bell grid. */
	time?: string;
}

const range = (from: number, to: number): number[] =>
	Array.from({ length: to - from + 1 }, (_, index) => from + index);

const row = (
	disciplineId: string,
	discipline: string,
	group: string,
	day: string,
	slot: string,
	weeks: number[],
	extra: Partial<FixtureRow> = {},
): FixtureRow => ({
	disciplineId,
	discipline,
	group,
	day,
	slot,
	weeks,
	source: "2026_1_1476_4.xlsx",
	...extra,
});

export const ROWS: FixtureRow[] = [
	row(
		"БПП",
		"Багатозадачне та паралельне програмування",
		"лекція",
		"Середа",
		"10:00-11:20",
		range(2, 12),
		{ room: "1-313", teacher: "проф. Г.І.Малаш" },
	),
	row(
		"БПП",
		"Багатозадачне та паралельне програмування",
		"1",
		"Середа",
		"11:40-13:00",
		range(2, 12),
	),
	row(
		"БПП",
		"Багатозадачне та паралельне програмування",
		"2",
		"Середа",
		"13:30-14:50",
		range(2, 12),
	),
	row(
		"БПП",
		"Багатозадачне та паралельне програмування",
		"3",
		"Середа",
		"15:00-16:20",
		range(2, 12),
	),
	row(
		"БПП",
		"Багатозадачне та паралельне програмування",
		"4",
		"Середа",
		"16:30-17:50",
		range(2, 12),
	),
	row(
		"ІМ",
		"Інтелектуальні мережі",
		"лекція",
		"Вівторок",
		"8:30-9:50",
		range(1, 7),
	),
	row(
		"ІМ",
		"Інтелектуальні мережі",
		"1",
		"Вівторок",
		"10:00-11:20",
		range(1, 14),
	),
	row(
		"ІМ",
		"Інтелектуальні мережі",
		"2",
		"Вівторок",
		"11:40-13:00",
		range(1, 14),
	),
	row(
		"ІМ",
		"Інтелектуальні мережі",
		"3",
		"Вівторок",
		"13:30-14:50",
		range(1, 14),
	),
	row(
		"ІМ",
		"Інтелектуальні мережі",
		"4",
		"Вівторок",
		"15:00-16:20",
		range(1, 14),
	),
	row(
		"ІБЦС",
		"Інформаційна безпека цільових систем",
		"лекція",
		"Середа",
		"11:40-13:00",
		range(3, 9),
		{ source: "2026_1_1472_4.xlsx" },
	),
	row(
		"ІБЦС",
		"Інформаційна безпека цільових систем",
		"1",
		"Середа",
		"13:30-14:50",
		range(3, 10),
		{ source: "2026_1_1472_4.xlsx" },
	),
	row(
		"ТнВ",
		"Технології на війні",
		"лекція",
		"Вівторок",
		"11:40-13:00",
		range(1, 10),
		{
			source: "2026_1_1472_3.xlsx",
		},
	),
	row("ТнВ", "Технології на війні", "1", "Середа", "10:00-11:20", range(2, 6), {
		source: "2026_1_1472_3.xlsx",
	}),
	row("ТнВ", "Технології на війні", "2", "Середа", "11:40-13:00", range(2, 6), {
		source: "2026_1_1472_3.xlsx",
	}),
	row(
		"ТнВ",
		"Технології на війні",
		"3",
		"Понеділок",
		"16:30-17:50",
		range(2, 6),
		{
			source: "2026_1_1472_3.xlsx",
		},
	),
	// Two sheets publish ФВ with *different* content — they must stay separate
	// labelled offerings (regression: merging fabricated impossible plans).
	row(
		"ФВ",
		"Фізичне виховання",
		"лекція",
		"П'ятниця",
		"8:30-9:50",
		range(1, 12),
		{
			source: "2026_1_1476_4.xlsx",
		},
	),
	row(
		"ФВ",
		"Фізичне виховання",
		"лекція",
		"Субота",
		"8:30-9:50",
		range(1, 12),
		{
			source: "2026_1_1472_3.xlsx",
		},
	),
	// Off the bell grid: group 1 is a whole Saturday («08:30-16:20») that
	// lands on ПА's 11:40 lecture only by its clock; group 2 runs the lower
	// half of Thursday's second pair.
	row("ВС", "Виїзний семінар", "1", "Субота", "8:30-9:50", [4, 8], {
		time: "08:30-16:20",
	}),
	row("ВС", "Виїзний семінар", "2", "Четвер", "10:00-11:20", range(2, 12), {
		time: "10:40-11:20",
	}),
	row(
		"ПА",
		"Польова астрономія",
		"лекція",
		"Субота",
		"11:40-13:00",
		range(1, 12),
	),
];

/** Real Осінь 2026 teaching weeks; week 1 starts on Tuesday 01.09. */
const WEEK_DATES: Record<string, { start: string; end: string }> = {};
{
	WEEK_DATES["1"] = { start: "2026-09-01", end: "2026-09-04" };
	let monday = new Date("2026-09-07T00:00:00Z");
	for (let week = 2; week <= 14; week++) {
		const friday = new Date(monday.getTime() + 4 * 86_400_000);
		WEEK_DATES[String(week)] = {
			start: monday.toISOString().slice(0, 10),
			end: friday.toISOString().slice(0, 10),
		};
		monday = new Date(monday.getTime() + 7 * 86_400_000);
	}
}

export const SEMESTER_FIXTURE = {
	semester: "Осінь 2026–2027 (фікстура)",
	ingestedAt: "2026-08-19T06:00:00.000Z",
	rowsTotal: ROWS.length,
	rows: ROWS,
	review: [
		{
			source: "2026_1_1472_3.xlsx",
			day: "Середа",
			time: "16.40 – 17.50",
			discipline: "Фізичне виховання",
			group: "зустріч",
			weeks: "02.09.26",
			room: "",
			problems: ["group:зустріч", "weeks:02.09.26"],
		},
	],
	weekDates: WEEK_DATES,
	files: [
		{
			source: "2026_1_1476_4.xlsx",
			label: "Комп'ютерні науки БП-4",
			url: "https://my.ukma.edu.ua/files/schedule/2026/1/1476/4.xlsx",
		},
		{
			source: "2026_1_1472_4.xlsx",
			label: "Прикладна математика БП-4",
			url: "https://my.ukma.edu.ua/files/schedule/2026/1/1472/4.xlsx",
		},
		{
			source: "2026_1_1472_3.xlsx",
			label: "Прикладна математика БП-3",
			url: "https://my.ukma.edu.ua/files/schedule/2026/1/1472/3.xlsx",
		},
	],
};

/** The off-grid pair: a full-day block and the lecture its clock lands on. */
export const OFF_GRID_PICKED = ["ВС", "ПА"];

/** The four ground-truth disciplines, for seeding app state. */
export const PICKED = ["БПП", "ІМ", "ІБЦС", "ТнВ"];

export const COMPLETE_SELECTION = { БПП: "3", ІМ: "1", ІБЦС: "1", ТнВ: "3" };

const rowOf = (disciplineId: string, group: string): FixtureRow => {
	const found = ROWS.find(
		(row) => row.disciplineId === disciplineId && row.group === group,
	);
	if (!found) throw new Error(`no fixture row ${disciplineId} ${group}`);
	return found;
};

/** GET /api/me/changes for ME_RETURNING's plan: one of each kind since the
 *  bookmark. The lessons as they are now are the fixture's own rows, so the
 *  grid finds them under the same keys. */
export const CHANGES_FIXTURE = {
	fromIngestId: 2,
	toIngestId: 3,
	toAt: "2026-08-19T10:30:00.000Z",
	changes: [
		{
			kind: "cancelled",
			before: { ...rowOf("ІМ", "лекція"), weeks: range(1, 8) },
			after: rowOf("ІМ", "лекція"),
			weeks: [8],
			corrected: false,
		},
		{
			kind: "room",
			before: { ...rowOf("БПП", "лекція"), room: "1-225" },
			after: rowOf("БПП", "лекція"),
			weeks: [],
			corrected: false,
		},
		{
			kind: "moved",
			before: { ...rowOf("БПП", "3"), day: "Вівторок" },
			after: rowOf("БПП", "3"),
			weeks: [],
			corrected: false,
		},
		{
			kind: "added",
			after: rowOf("ТнВ", "3"),
			weeks: rowOf("ТнВ", "3").weeks,
			corrected: false,
		},
	],
};

export const NO_CHANGES = {
	fromIngestId: 3,
	toIngestId: 3,
	toAt: "2026-08-19T10:30:00.000Z",
	changes: [],
};

/** Two readings of the semester: reading 1 had every ІМ lesson in room 999
 *  and no ТнВ group 3 yet; reading 2 is the fixture as served. */
export const VERSIONS_FIXTURE = {
	list: [
		{
			id: 3,
			at: "2026-08-19T10:30:00.000Z",
			rows: ROWS.length,
			review: 1,
			rowsAdded: 1,
			rowsRemoved: 1,
			filesChanged: ["2026_1_1499_1.xlsx"],
			// Another faculty's sheet: nothing of the fixture plans moved.
			disciplinesChanged: ["ФВ"],
		},
		{
			id: 2,
			at: "2026-08-19T06:00:00.000Z",
			rows: ROWS.length,
			review: 1,
			rowsAdded: 1,
			rowsRemoved: 0,
			filesChanged: ["2026_1_1476_4.xlsx", "2026_1_1472_3.xlsx"],
			disciplinesChanged: ["ІМ", "ТнВ"],
		},
		{
			id: 1,
			at: "2026-08-12T06:00:00.000Z",
			rows: ROWS.length - 1,
			review: 1,
			rowsAdded: ROWS.length - 1,
			rowsRemoved: 0,
			filesChanged: [],
			disciplinesChanged: [],
		},
	],
	rowsOf: new Map<number, FixtureRow[]>([
		[
			1,
			ROWS.filter(
				(row) => !(row.disciplineId === "ТнВ" && row.group === "3"),
			).map((row) =>
				row.disciplineId === "ІМ" ? { ...row, room: "999" } : row,
			),
		],
		[2, ROWS],
		[3, ROWS],
	]),
};

/** A room change on the full-day off-grid block, for the spanning card. */
export const OFF_GRID_CHANGES = {
	...NO_CHANGES,
	fromIngestId: 2,
	changes: [
		{
			kind: "room",
			before: { ...rowOf("ВС", "1"), room: "1-225" },
			after: rowOf("ВС", "1"),
			weeks: [],
			corrected: false,
		},
	],
};
