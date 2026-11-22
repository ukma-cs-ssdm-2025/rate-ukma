import { KIND_LABELS, SYNC_KINDS } from "./syncLabels";

const OTHER_WORDS: ReadonlyMap<string, string> = new Map([
	[
		"relink_course",
		"Сторінка дисципліни прив'яжеться до іншого запису САЗ; оцінки залишаються на ній.",
	],
]);

export function otherChangeText(kind: string): string {
	const words = OTHER_WORDS.get(kind);
	if (words !== undefined) {
		return words;
	}
	const known = SYNC_KINDS.find((name) => name === kind);
	return known === undefined
		? "Інша зміна з САЗ"
		: `${KIND_LABELS[known]}: зміна з САЗ`;
}
