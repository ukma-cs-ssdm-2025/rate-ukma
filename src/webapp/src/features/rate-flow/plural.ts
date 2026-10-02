import type { CourseTerm } from "@/lib/course-term";

/** Ukrainian noun form for a count: 1 курс, 2 курси, 5 курсів. */
export function pluralUk(
	count: number,
	forms: readonly [one: string, few: string, many: string],
): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return forms[0];
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
	return forms[2];
}

export const coursesNoun = (count: number, term: CourseTerm) =>
	pluralUk(
		count,
		term(
			["курс", "курси", "курсів"] as const,
			["дисципліна", "дисципліни", "дисциплін"] as const,
		),
	);

/** «N курсів чекають», agreeing with the count. */
export const coursesWaiting = (count: number, term: CourseTerm) =>
	pluralUk(
		count,
		term(
			["курс чекає", "курси чекають", "курсів чекають"] as const,
			["дисципліна чекає", "дисципліни чекають", "дисциплін чекають"] as const,
		),
	);
