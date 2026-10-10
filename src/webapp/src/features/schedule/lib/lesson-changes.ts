import type { LessonChange, LessonRow, Week } from "@/features/schedule/core";
import { lessonKey } from "@/features/schedule/core";
import { DAY_SHORT, formatWeeks } from "@/features/schedule/lib/format";

/** Where a lesson stood before the faculty moved or cancelled it: drawn on
 *  the grid as a dashed trace. `weekOnly` is a cancellation of some weeks,
 *  which the semester view already shows by the lesson's shorter weeks. */
export interface ChangeGhost {
	readonly row: LessonRow;
	readonly note: string;
	readonly weekOnly: boolean;
}

/** What the grid marks: each changed lesson by the key it renders under
 *  (corrected or not, a lesson keeps its printed key), and the traces. */
export interface ChangeMarks {
	readonly byLesson: ReadonlyMap<string, LessonChange>;
	readonly ghosts: ReadonlyArray<ChangeGhost>;
}

export const NO_MARKS: ChangeMarks = { byLesson: new Map(), ghosts: [] };

const dayShort = (row: LessonRow): string => DAY_SHORT[row.day].toLowerCase();

const startOf = (row: LessonRow): string =>
	(row.time ?? row.slot).split("-")[0] ?? row.slot;

/** «Вт 10:00–11:20», with the printed time when the lesson runs off the bell. */
export const whenOf = (row: LessonRow): string =>
	`${DAY_SHORT[row.day]} ${(row.time ?? row.slot).replace("-", "–")}`;

/** «тиждень 6», «тижні 3–14». */
export const weeksLabel = (weeks: ReadonlyArray<Week>): string =>
	weeks.length === 1 ? `тиждень ${weeks[0]}` : `тижні ${formatWeeks(weeks)}`;

const movedFrom = (before: LessonRow, after: LessonRow): string => {
	if (before.day !== after.day) return `перенесено з ${dayShort(before)}`;
	if (startOf(before) !== startOf(after))
		return `перенесено з ${startOf(before)}`;
	return "інші тижні";
};

/** The pill on a changed lesson, said from where it is now. */
export const pillOf = (change: LessonChange): string => {
	const { before, after } = change;
	switch (change.kind) {
		case "moved":
			return before && after ? movedFrom(before, after) : "перенесено";
		case "room":
			return "нова аудиторія";
		case "cancelled":
			return change.weeks.length === 1
				? `скасовано на тижні ${change.weeks[0]}`
				: `скасовано на тижнях ${formatWeeks(change.weeks)}`;
		case "added":
			return before ? `додано ${weeksLabel(change.weeks)}` : "нова пара";
	}
};

const ghostOf = (change: LessonChange): ChangeGhost | undefined => {
	const { before, after } = change;
	if (!before) return undefined;
	if (change.kind === "moved" && after && whenOf(before) !== whenOf(after)) {
		const where = before.day !== after.day ? dayShort(after) : startOf(after);
		return {
			row: before,
			note: `тут було, перенесено на ${where}`,
			weekOnly: false,
		};
	}
	if (change.kind !== "cancelled") return undefined;
	return after
		? {
				row: { ...before, weeks: change.weeks },
				note: "скасовано",
				weekOnly: true,
			}
		: { row: before, note: "скасовано", weekOnly: false };
};

export const marksOf = (changes: ReadonlyArray<LessonChange>): ChangeMarks => ({
	byLesson: new Map(
		changes.flatMap((change) =>
			change.after ? [[lessonKey(change.after), change]] : [],
		),
	),
	ghosts: changes.flatMap((change) => {
		const ghost = ghostOf(change);
		return ghost ? [ghost] : [];
	}),
});

/** The traces a grid of this week (or the whole semester) shows. */
export const ghostsIn = (
	ghosts: ReadonlyArray<ChangeGhost>,
	week: Week | undefined,
): ReadonlyArray<ChangeGhost> =>
	ghosts.filter((ghost) =>
		week === undefined ? !ghost.weekOnly : ghost.row.weeks.includes(week),
	);

/** A change happens in this week when the lesson ran or runs in it. */
export const touchesWeek = (change: LessonChange, week: Week): boolean =>
	change.kind === "cancelled" || change.kind === "added"
		? change.weeks.includes(week)
		: [
				...(change.before?.weeks ?? []),
				...(change.after?.weeks ?? []),
			].includes(week);
