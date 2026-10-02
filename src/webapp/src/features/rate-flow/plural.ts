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

export const coursesNoun = (count: number) =>
	pluralUk(count, ["курс", "курси", "курсів"]);
