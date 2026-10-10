import { timeOf, type SlotTime } from "../calendar/dates.ts";
import type { LessonRow, Week } from "../domain/schedule.ts";

/**
 * Two rows clash only when they share a day, some minutes **and** at least one
 * teaching week. Same slot in disjoint weeks is not a clash — several
 * disciplines legitimately alternate across odd/even weeks in the same slot.
 * The minutes are the printed ones (`timeOf`): a Saturday block «08:30-16:20»
 * sits in the first slot yet lands on the 11:40 pair too.
 */
export const sharedWeeks = (
	a: LessonRow,
	b: LessonRow,
): ReadonlyArray<Week> => {
	const bWeeks = new Set<number>(b.weeks);
	return a.weeks.filter((week) => bWeeks.has(week));
};

/** The minutes two rows share, or undefined when one ends before the other
 *  starts. Clocks are zero-padded, so they compare as strings. */
export const sharedTime = (
	a: LessonRow,
	b: LessonRow,
): SlotTime | undefined => {
	const [x, y] = [timeOf(a), timeOf(b)];
	const start = x.start > y.start ? x.start : y.start;
	const end = x.end < y.end ? x.end : y.end;
	return start < end ? { start, end } : undefined;
};

export const overlaps = (a: LessonRow, b: LessonRow): boolean =>
	a.day === b.day &&
	sharedTime(a, b) !== undefined &&
	sharedWeeks(a, b).length > 0;

export interface Clash {
	readonly a: LessonRow;
	readonly b: LessonRow;
	readonly weeks: ReadonlyArray<Week>;
}

export const findClashes = (
	rows: ReadonlyArray<LessonRow>,
): ReadonlyArray<Clash> => {
	const clashes: Array<Clash> = [];
	for (let i = 0; i < rows.length; i++) {
		for (let j = i + 1; j < rows.length; j++) {
			const a = rows[i]!;
			const b = rows[j]!;
			if (a.disciplineId === b.disciplineId) continue;
			if (!overlaps(a, b)) continue;
			clashes.push({ a, b, weeks: sharedWeeks(a, b) });
		}
	}
	return clashes;
};

export const isClashFree = (rows: ReadonlyArray<LessonRow>): boolean =>
	findClashes(rows).length === 0;
