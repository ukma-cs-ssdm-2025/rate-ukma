import type { Offering } from "@/features/schedule/core";

/** One catalog hit: the discipline, and the teacher when the query named
 *  a teacher rather than the discipline. */
export interface Match {
	readonly offering: Offering;
	readonly teacher: string | undefined;
}

/** Lower case, one apostrophe, one space: САЗ, the sheets and a phone
 *  keyboard each spell «Комп'ютерні» their own way. */
const fold = (text: string): string =>
	text
		.toLowerCase()
		.replace(/[’ʼ`´‘]/gu, "'")
		.replace(/\s+/gu, " ")
		.trim();

const teachersOf = (offering: Offering): ReadonlyArray<string> => [
	...new Set(
		[...offering.lectures, ...Object.values(offering.groups).flat()].flatMap(
			(row) => (row.teacher?.trim() ? [row.teacher.trim()] : []),
		),
	),
];

/**
 * Every discipline whose name, or one of whose teachers, holds every word
 * of the query, in any order: «паралельне багатозадачне» and «Сидорова»
 * both find what a student means. Names first, alphabetically.
 */
export const searchOfferings = (
	offerings: ReadonlyArray<Offering>,
	query: string,
	limit = 30,
): ReadonlyArray<Match> => {
	const words = fold(query).split(" ").filter(Boolean);
	if (words.length === 0) return [];
	const holds = (text: string) => {
		const folded = fold(text);
		return words.every((word) => folded.includes(word));
	};
	const byName: Match[] = [];
	const byTeacher: Match[] = [];
	for (const offering of offerings) {
		if (holds(offering.discipline)) {
			byName.push({ offering, teacher: undefined });
			continue;
		}
		const teacher = teachersOf(offering).find(holds);
		if (teacher) byTeacher.push({ offering, teacher });
	}
	const order = (a: Match, b: Match) =>
		a.offering.discipline.localeCompare(b.offering.discipline, "uk");
	return [...byName.sort(order), ...byTeacher.sort(order)].slice(0, limit);
};
