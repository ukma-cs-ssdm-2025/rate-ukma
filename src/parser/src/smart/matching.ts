import type { TeacherRole } from "./catalog.ts";

/** What the rule reads of a САЗ offering. */
export interface MatchOffering {
	readonly id: string;
	readonly title: string;
	readonly credits: number;
	readonly departmentName: string | null;
	readonly level: "bachelor" | "master";
	readonly sazTeachers: string | null;
}

/** What the rule reads of a smart.ukma discipline, with its teachers' ids. */
export interface MatchDiscipline {
	readonly title: string;
	readonly credits: number;
	readonly departmentName: string | null;
	readonly level: "bachelor" | "master" | null;
	readonly teachers: ReadonlyArray<{
		readonly smartId: number;
		readonly role: TeacherRole;
	}>;
}

export interface MatchTeacher {
	readonly smartId: number;
	readonly lastName: string;
}

export interface OfferingTeacher {
	readonly offeringId: string;
	readonly smartId: number;
	readonly role: TeacherRole;
}

export interface MatchResult {
	readonly links: ReadonlyArray<OfferingTeacher>;
	readonly report: MatchReport;
}

export interface MatchReport {
	readonly linked: number;
	readonly tieBrokenBySaz: number;
	readonly tieLeft: number;
	readonly sazDisagrees: number;
}

/** Titles match after case, spaces, quotes, dashes and punctuation, with the
 *  conjunctions та, й, і and и read as one word. */
export const normalisedTitle = (title: string): string =>
	title
		.toLowerCase()
		.replace(/[’ʼ'`"«»„“”]/g, "")
		.replace(/[\p{P}\p{S}–—-]+/gu, " ")
		.split(/\s+/)
		.filter((word) => word !== "")
		.map((word) => (["та", "й", "і", "и"].includes(word) ? "і" : word))
		.join(" ");

/** A department name as both systems spell it apart from case, quotes and an
 *  "імені …" suffix. */
const normalisedDepartment = (name: string): string =>
	normalisedTitle(name.replace(/\s+імені\s.*$/iu, ""));

/** САЗ department names, normalised, that smart.ukma names differently:
 *  САЗ calls these schools "Кафедра ..." or drops smart.ukma's "Кафедра".
 *  Read from both live department lists; every other department with
 *  offerings matches by its normalised name or has no smart.ukma twin. */
const DEPARTMENT_ALIASES: ReadonlyMap<string, string> = new Map([
	[
		"кафедра києво могилянська школа врядування",
		"києво могилянська школа врядування",
	],
	["кафедра школа громадського здоровя", "школа громадського здоровя"],
	["кафедра школа соціальної роботи", "школа соціальної роботи"],
	[
		"кафедра школа управління в охороні здоровя",
		"школа управління в охороні здоровя",
	],
	["могилянська школа журналістики", "кафедра могилянська школа журналістики"],
]);

export const departmentKey = (name: string | null): string | null => {
	if (name === null) {
		return null;
	}

	const key = normalisedDepartment(name);

	return DEPARTMENT_ALIASES.get(key) ?? key;
};

const keyOf = (
	title: string,
	credits: number,
	department: string | null,
	level: string,
) => `${normalisedTitle(title)}|${credits}|${department}|${level}`;

/** One role for a teacher named in several disciplines of one offering. */
const joinedRole = (a: TeacherRole, b: TeacherRole): TeacherRole =>
	a === b ? a : "LECTURER_AND_PRACTICE_TEACHER";

/** A name in lower case with every apostrophe spelled one way, so САЗ's
 *  "Лук’яненко" and smart.ukma's "Лук'яненко" compare equal. */
const nameForm = (text: string): string =>
	text.toLowerCase().replace(/[’ʼ`‘]/g, "'");

const wordsOf = (text: string): ReadonlySet<string> =>
	new Set(
		nameForm(text)
			.split(/[^\p{L}\p{N}'-]+/u)
			.filter((word) => word !== ""),
	);

/** The automatic part of the matching rule. An offering takes smart.ukma
 *  teachers when its disciplines agree on title, credits, mapped department
 *  and level, and either name one teacher set or САЗ's teacher text settles a
 *  tie. САЗ "names" a teacher when the text holds their last name. A tie САЗ
 *  cannot settle, and a set САЗ contradicts, stay unlinked: they are review
 *  cases, which come later. */
export const matchTeachers = (
	offerings: ReadonlyArray<MatchOffering>,
	disciplines: ReadonlyArray<MatchDiscipline>,
	teachers: ReadonlyArray<MatchTeacher>,
): MatchResult => {
	const candidates = new Map<string, Array<MatchDiscipline>>();

	for (const discipline of disciplines) {
		if (discipline.level === null || discipline.teachers.length === 0) {
			continue;
		}

		const key = keyOf(
			discipline.title,
			discipline.credits,
			departmentKey(discipline.departmentName),
			discipline.level,
		);

		candidates.set(key, [...(candidates.get(key) ?? []), discipline]);
	}

	const lastNames = new Map(
		teachers.map(({ smartId, lastName }) => [smartId, nameForm(lastName)]),
	);

	const allLastNames = new Set([...lastNames.values()].filter((n) => n !== ""));
	const links: Array<OfferingTeacher> = [];
	const report = { linked: 0, tieBrokenBySaz: 0, tieLeft: 0, sazDisagrees: 0 };

	for (const offering of offerings) {
		const department = departmentKey(offering.departmentName);

		if (department === null) {
			continue;
		}

		const matched = candidates.get(
			keyOf(offering.title, offering.credits, department, offering.level),
		);

		if (matched === undefined) {
			continue;
		}

		const roles = new Map<number, TeacherRole>();

		for (const { smartId, role } of matched.flatMap((d) => d.teachers)) {
			const held = roles.get(smartId);

			roles.set(smartId, held === undefined ? role : joinedRole(held, role));
		}

		const setOf = (d: MatchDiscipline) =>
			[...new Set(d.teachers.map(({ smartId }) => smartId))].sort().join(",");

		const oneSet = new Set(matched.map(setOf)).size === 1;
		const words = wordsOf(offering.sazTeachers ?? "");

		const named = [...roles.keys()].filter((id) => {
			const lastName = lastNames.get(id);

			return lastName !== undefined && words.has(lastName);
		});

		const sazNamesSmart = [...words].some((word) => allLastNames.has(word));

		// A last name САЗ shares with another candidate cannot say which of
		// them it means.
		const namedLastNames = named.map((id) => lastNames.get(id));

		const namesOnePerson =
			new Set(namedLastNames).size === namedLastNames.length;

		let chosen: ReadonlyArray<number>;

		if (oneSet) {
			if (sazNamesSmart && named.length === 0) {
				report.sazDisagrees += 1;
				continue;
			}

			chosen = [...roles.keys()];
			report.linked += 1;
		} else if (named.length > 0 && namesOnePerson) {
			chosen = named;
			report.tieBrokenBySaz += 1;
		} else {
			report.tieLeft += 1;
			continue;
		}

		for (const smartId of chosen) {
			links.push({
				offeringId: offering.id,
				smartId,
				role: roles.get(smartId) ?? "LECTURER",
			});
		}
	}

	return { links, report };
};
