import type { BellSlot, Day, LessonRow, Week } from "../domain/schedule.ts";
import { DAYS } from "../domain/schedule.ts";

/** Week number -> the real dates it spans, from the `Навчальні тижні` table
 * (or the per-semester academic calendar fallback). ISO `YYYY-MM-DD`. */
export type WeekDates = ReadonlyMap<
	Week,
	{ readonly start: string; readonly end: string }
>;

export interface SlotTime {
	readonly start: string;
	readonly end: string;
}

/** Bell slot -> wall-clock times, zero-padded for .ics arithmetic. */
export const SLOT_TIMES = {
	"8:30-9:50": { start: "08:30", end: "09:50" },
	"10:00-11:20": { start: "10:00", end: "11:20" },
	"11:40-13:00": { start: "11:40", end: "13:00" },
	"13:30-14:50": { start: "13:30", end: "14:50" },
	"15:00-16:20": { start: "15:00", end: "16:20" },
	"16:30-17:50": { start: "16:30", end: "17:50" },
	"18:00-19:20": { start: "18:00", end: "19:20" },
	"19:30-20:50": { start: "19:30", end: "20:50" },
} satisfies Record<BellSlot, SlotTime>;

/** One concrete dated occurrence of a lesson row. */
export interface DatedLesson {
	readonly row: LessonRow;
	readonly week: Week;
	/** ISO date of the occurrence. */
	readonly date: string;
	readonly time: SlotTime;
}

/** A (row, week) pair that could not be dated, kept visible per ADR 0001. */
export interface UndatedLesson {
	readonly row: LessonRow;
	readonly week: Week;
	readonly reason: "week-not-in-calendar" | "day-outside-week-range";
}

export interface Expansion {
	readonly events: ReadonlyArray<DatedLesson>;
	readonly undated: ReadonlyArray<UndatedLesson>;
}

/** «14:30-16:00» → wall-clock start and end; a row without a printed time
 *  runs on its bell slot. */
export const timeOf = (row: LessonRow): SlotTime => {
	const printed = row.time?.split("-");
	if (printed?.length !== 2) return SLOT_TIMES[row.slot];
	const pad = (clock: string) => (clock.length === 4 ? `0${clock}` : clock);
	return { start: pad(printed[0]!), end: pad(printed[1]!) };
};

const DAY_INDEX = new Map<Day, number>(DAYS.map((day, index) => [day, index]));

const isoToUtc = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

const utcToIso = (date: Date): string => date.toISOString().slice(0, 10);

/** Monday = 0 ... Sunday = 6, matching DAY_INDEX. */
const weekdayIndex = (date: Date): number => (date.getUTCDay() + 6) % 7;

/**
 * The date of `day` inside the week spanning [start, end] — anchored on the
 * start date's own weekday, because a teaching week can start mid-week
 * (week 1 of Осінь 2026 runs Вт 01.09 – Пт 04.09).
 */
export const dateOfDayInWeek = (
	start: string,
	end: string,
	day: Day,
): string | undefined => {
	const target = DAY_INDEX.get(day);
	if (target === undefined) return undefined;
	const startDate = isoToUtc(start);
	const offset = target - weekdayIndex(startDate);
	if (offset < 0) return undefined;
	const candidate = new Date(startDate.getTime() + offset * 86_400_000);
	return candidate.getTime() <= isoToUtc(end).getTime()
		? utcToIso(candidate)
		: undefined;
};

/** Stage 2 heart: rows × weeks -> dated events, with undated leftovers kept. */
export const expandRows = (
	rows: ReadonlyArray<LessonRow>,
	weekDates: WeekDates,
): Expansion => {
	const events: Array<DatedLesson> = [];
	const undated: Array<UndatedLesson> = [];
	for (const row of rows) {
		for (const week of row.weeks) {
			const span = weekDates.get(week);
			if (!span) {
				undated.push({ row, week, reason: "week-not-in-calendar" });
				continue;
			}
			const date = dateOfDayInWeek(span.start, span.end, row.day);
			if (!date) {
				undated.push({ row, week, reason: "day-outside-week-range" });
				continue;
			}
			events.push({ row, week, date, time: timeOf(row) });
		}
	}
	events.sort((a, b) =>
		a.date === b.date
			? a.time.start.localeCompare(b.time.start)
			: a.date.localeCompare(b.date),
	);
	return { events, undated };
};

/** Every teaching week of a semester, in order. Takes the semester-like
 *  rather than the map so web callers keep their shape. */
export const weeksOf = (
	semester: { readonly weekDates: WeekDates } | undefined,
): ReadonlyArray<Week> => {
	if (!semester) return [];
	return [...semester.weekDates.keys()].sort((a, b) => a - b);
};
