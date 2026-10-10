import type { Day, Week, WeekDates } from "@/features/schedule/core";
import { DAYS } from "@/features/schedule/core";

export { weekPatternOf, type WeekPattern } from "@/features/schedule/core";

/** The teaching week `today` falls in, counting the weekend after a week as
 *  still that week; undefined outside the semester. */
export const currentWeekOf = (
	weekDates: WeekDates,
	today: Date,
): Week | undefined => {
	const iso = today.toISOString().slice(0, 10);
	const ordered = [...weekDates].sort(([a], [b]) => a - b);
	for (let i = 0; i < ordered.length; i++) {
		const [week, span] = ordered[i]!;
		const next = ordered[i + 1]?.[1].start;
		if (
			iso >= span.start &&
			(next === undefined ? iso <= span.end : iso < next)
		) {
			return week;
		}
	}
	return undefined;
};

/** The week one step from `week` in `weeks`. From the whole semester a step
 *  forward opens the first week and a step back the last; the ends are
 *  walls, not a loop. Undefined when there is nowhere to go. */
export const stepWeek = (
	weeks: ReadonlyArray<Week>,
	week: Week | undefined,
	delta: -1 | 1,
): Week | undefined => {
	if (weeks.length === 0) return undefined;
	if (week === undefined)
		return delta === 1 ? weeks[0] : weeks[weeks.length - 1];
	return weeks[weeks.indexOf(week) + delta];
};

/** `today` as a local calendar date, the form week spans are stored in. */
export const localIsoDate = (today: Date): string => {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
};

/** The weekday of a local `YYYY-MM-DD` date, in the schedule's vocabulary. */
export const weekdayOf = (iso: string): Day => {
	const parts = iso.split("-").map(Number);
	const date = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
	return DAYS[(date.getDay() + 6) % 7]!;
};

/** Where a "now" line sits on a day of bell slots: the row and how far down
 *  it (0 at the bell, 1 at the end). Between two pairs the line waits at the
 *  top of the next one; before the first or after the last there is none. */
export const nowMarkOf = <S extends string>(
	slots: ReadonlyArray<S>,
	now: Date,
): { readonly slot: S; readonly fraction: number } | undefined => {
	const minutes = now.getHours() * 60 + now.getMinutes();
	const toMinutes = (clock: string) => {
		const [h, m] = clock.split(":");
		return Number(h) * 60 + Number(m);
	};
	for (const slot of slots) {
		const [start, end] = slot.split("-").map((clock) => toMinutes(clock!));
		if (minutes >= end!) continue;
		if (minutes < start! && slot === slots[0]) return undefined;
		return {
			slot,
			fraction: Math.max(0, (minutes - start!) / (end! - start!)),
		};
	}
	return undefined;
};
