import type { Day, LessonRow, Week } from "../domain/schedule.ts";
import { BELL_SLOTS } from "../domain/schedule.ts";
import { SLOT_TIMES, timeOf, type SlotTime, type WeekDates } from "./dates.ts";

export const DAY_SHORT = {
	Понеділок: "Пн",
	Вівторок: "Вт",
	Середа: "Ср",
	Четвер: "Чт",
	"П'ятниця": "Пт",
	Субота: "Сб",
	Неділя: "Нд",
} satisfies Record<Day, string>;

/** «Дисципліна · варіант» without the variant suffix. */
export const shortName = (name: string): string => name.split(" · ")[0]!;

/** Words that carry no initial in a student's abbreviation: the conjunctions.
 *  «Багатозадачне та паралельне програмування» is БПП, while a preposition
 *  keeps its letter: «Технології на війні» is ТНВ, the way students write it. */
const FILLER = {
	та: true,
	і: true,
	й: true,
	and: true,
	the: true,
	of: true,
} satisfies Record<string, true>;

/** Published names carry residue the abbreviation must not: a second
 *  language after «/», a faculty or language mark in brackets, a teacher
 *  list after a comma or a title, and further sentences after the first. */
const TITLE_RESIDUE =
	/\s*(?:\/|\(|,|:|"|«|\.\s+[А-ЯІЇЄA-Z]|\s(?:проф|доц|ст\.\s*викл|ас|викл)\.).*$/u;

const coreTitle = (name: string): string =>
	shortName(name).replace(TITLE_RESIDUE, "").trim();

/** How many initials an abbreviation may carry before it stops being one. */
const MAX_INITIALS = 6;

/** The initials students use for a long discipline name, or the name itself
 *  when it is short, a single word, or would not shrink. Roman numerals and
 *  numbers stay whole («Математичний аналіз II» is МА II). */
export const abbreviate = (name: string): string => {
	const base = coreTitle(name) || shortName(name);
	if (base.length <= 18) return base;
	const words = base.split(/\s+/u).filter((word) => word.length > 0);
	const parts: string[] = [];
	for (const word of words) {
		const bare = word.replace(/[^\p{L}\p{N}]/gu, "");
		if (bare.length === 0 || bare.toLowerCase() in FILLER) continue;
		if (/^[IVX]+$|^\d+$/u.test(bare)) parts.push(` ${bare} `);
		else parts.push(bare[0]!.toUpperCase());
	}
	const short = parts.join("").trim();
	const initials = short.replace(/[^\p{L}]/gu, "").length;
	return initials >= 2 &&
		initials <= MAX_INITIALS &&
		short.length < base.length / 2
		? short
		: base;
};

/** What each discipline of a plan is called on the grid and in the calendar:
 *  the abbreviation when asked for, but the full name whenever two
 *  disciplines of the same plan would share one («Вступ до політології» and
 *  «Вступ до програмування» are both ВП). */
export const labelsOf = (
	items: ReadonlyArray<{
		readonly disciplineId: string;
		readonly discipline: string;
	}>,
	shortNames: boolean,
	names?: ReadonlyMap<string, string>,
): ReadonlyMap<string, string> => {
	const full = new Map(
		items.map((item) => [
			item.disciplineId,
			shortName(names?.get(item.disciplineId) ?? item.discipline),
		]),
	);
	if (!shortNames) return full;
	const short = new Map([...full].map(([id, name]) => [id, abbreviate(name)]));
	const seen = new Map<string, number>();
	for (const label of short.values())
		seen.set(label, (seen.get(label) ?? 0) + 1);
	return new Map(
		[...short].map(([id, label]) => [
			id,
			(seen.get(label) ?? 0) > 1 ? full.get(id)! : label,
		]),
	);
};

/** "2,3,4,5,7" -> "2–5, 7" — the way schedules print week lists. */
export const formatWeeks = (weeks: ReadonlyArray<Week>): string => {
	const parts: string[] = [];
	let start: number | undefined;
	let previous: number | undefined;
	const flush = () => {
		if (start === undefined || previous === undefined) return;
		parts.push(start === previous ? `${start}` : `${start}–${previous}`);
	};
	for (const week of weeks) {
		if (previous !== undefined && week === previous + 1) {
			previous = week;
			continue;
		}
		flush();
		start = week;
		previous = week;
	}
	flush();
	return parts.join(", ");
};

/** How a lesson's week list reads against the whole semester span. */
export interface WeekPattern {
	readonly label: string;
	readonly kind: "every" | "even" | "odd" | "some";
}

export const weekPatternOf = (
	weeks: ReadonlyArray<Week>,
	weekDates: WeekDates,
): WeekPattern => {
	const all = [...weekDates.keys()].sort((a, b) => a - b);
	const set = new Set<number>(weeks);
	const has = (parity: 0 | 1) => all.filter((week) => week % 2 === parity);
	const matches = (subset: ReadonlyArray<number>) =>
		subset.length > 0 &&
		subset.length === set.size &&
		subset.every((w) => set.has(w));
	if (matches(all)) return { label: "щотижня", kind: "every" };
	if (matches(has(0))) return { label: "парні тижні", kind: "even" };
	if (matches(has(1))) return { label: "непарні тижні", kind: "odd" };
	return { label: `тижні ${formatWeeks(weeks)}`, kind: "some" };
};

/** «08:30–16:20» as the grid prints clocks: «8:30–16:20». */
export const clockOf = (time: SlotTime): string =>
	`${time.start.replace(/^0/u, "")}–${time.end.replace(/^0/u, "")}`;

/** A time with its bell when it is one: «4 пара 13:30–14:50», else «10:40–11:20». */
export const describeTime = (time: SlotTime): string => {
	const bell = BELL_SLOTS.findIndex(
		(slot) =>
			SLOT_TIMES[slot].start === time.start &&
			SLOT_TIMES[slot].end === time.end,
	);
	return bell < 0 ? clockOf(time) : `${bell + 1} пара ${clockOf(time)}`;
};

/** Day and time: «Пт, 4 пара 13:30–14:50», or «Сб, 8:30–16:20» for a
 *  lesson the sheet prints off the bell grid. */
export const describeWhen = (row: LessonRow): string =>
	`${DAY_SHORT[row.day] ?? row.day}, ${describeTime(timeOf(row))}`;
