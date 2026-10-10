import { Schema } from "effect";
import { planLessons } from "../calendar/plan-lessons.ts";
import { fromRows, resolveVariants } from "../domain/offering.ts";
import {
	legacyKey,
	lessonKey,
	sameWeeks,
	type Overrides,
} from "../domain/overrides.ts";
import { BELL_SLOTS, DAYS, LessonRow, Week } from "../domain/schedule.ts";
import type { DisciplineId } from "../domain/schedule.ts";
import type { Selection } from "../domain/selection.ts";

/**
 * What the faculty changed in one student's own lessons between two readings
 * of the semester: the one the student last said they saw, and the current
 * one. Both readings are expanded with today's picks and groups, so a group
 * the student switched themselves is not a change; both are the printed
 * rows, so a lesson the student moved by hand is compared as the sheet has it.
 */

export const LessonChangeKind = Schema.Literals([
	"moved",
	"room",
	"cancelled",
	"added",
]);
export type LessonChangeKind = typeof LessonChangeKind.Type;

export const LessonChange = Schema.Struct({
	kind: LessonChangeKind,
	/** The lesson as the earlier reading printed it; absent for a new lesson. */
	before: Schema.optionalKey(LessonRow),
	/** As the current reading prints it; absent when the whole lesson is gone. */
	after: Schema.optionalKey(LessonRow),
	/** «cancelled»: the weeks it no longer runs; «added»: the weeks it newly runs. */
	weeks: Schema.Array(Week),
	/** The student corrected this lesson by hand; their version stays on the grid. */
	corrected: Schema.Boolean,
});
export interface LessonChange extends Schema.Schema.Type<typeof LessonChange> {}

export interface ChangePrefs {
	readonly picked: ReadonlyArray<DisciplineId>;
	/** Hidden disciplines are not attended, so their changes are not news. */
	readonly hidden: ReadonlyArray<DisciplineId>;
	readonly overrides?: Overrides;
	/** The sheet label of a source file, for the variants of one discipline. */
	readonly labelOf: (source: string) => string;
}

const printedLessons = (
	rows: ReadonlyArray<LessonRow>,
	selection: Selection,
	prefs: ChangePrefs,
): ReadonlyArray<LessonRow> => {
	const picked = new Set(prefs.picked);
	const offerings = fromRows(resolveVariants(rows, prefs.labelOf)).filter(
		(offering) => picked.has(offering.disciplineId),
	);
	return planLessons(offerings, selection, {
		hidden: prefs.hidden,
		shortNames: false,
	}).rows;
};

const streamOf = (row: LessonRow): string => `${row.disciplineId}|${row.group}`;

const samePlace = (a: LessonRow, b: LessonRow): boolean =>
	a.day === b.day && a.slot === b.slot && a.time === b.time;

const sameLesson = (a: LessonRow, b: LessonRow): boolean =>
	samePlace(a, b) &&
	sameWeeks(a.weeks, b.weeks) &&
	(a.room ?? "") === (b.room ?? "");

const order = (a: LessonRow, b: LessonRow): number =>
	DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
	BELL_SLOTS.indexOf(a.slot) - BELL_SLOTS.indexOf(b.slot);

const minus = (
	a: ReadonlyArray<Week>,
	b: ReadonlyArray<Week>,
): ReadonlyArray<Week> => {
	const drop = new Set(b);
	return a.filter((week) => !drop.has(week));
};

/** Same day and pair, other weeks: fewer is a cancellation, more is an
 *  addition, and a different set altogether reads as a move in time. */
const weeksChange = (
	before: LessonRow,
	after: LessonRow,
): Pick<LessonChange, "kind" | "weeks"> => {
	const gone = minus(before.weeks, after.weeks);
	const fresh = minus(after.weeks, before.weeks);
	if (fresh.length === 0) return { kind: "cancelled", weeks: gone };
	if (gone.length === 0) return { kind: "added", weeks: fresh };
	return { kind: "moved", weeks: [] };
};

/** One stream's leftover rows, paired from the closest match outward: the
 *  same place and weeks (only the room moved), the same place, the same
 *  weeks, then whatever is left in timetable order. */
const pairStream = (
	before: Array<LessonRow>,
	after: Array<LessonRow>,
): ReadonlyArray<Omit<LessonChange, "corrected">> => {
	const out: Array<Omit<LessonChange, "corrected">> = [];
	const passes: ReadonlyArray<{
		readonly match: (a: LessonRow, b: LessonRow) => boolean;
		readonly change: (
			a: LessonRow,
			b: LessonRow,
		) => Pick<LessonChange, "kind" | "weeks">;
	}> = [
		{
			match: (a, b) => samePlace(a, b) && sameWeeks(a.weeks, b.weeks),
			change: () => ({ kind: "room", weeks: [] }),
		},
		{ match: samePlace, change: weeksChange },
		{
			match: (a, b) => sameWeeks(a.weeks, b.weeks),
			change: () => ({ kind: "moved", weeks: [] }),
		},
		{ match: () => true, change: () => ({ kind: "moved", weeks: [] }) },
	];
	for (const pass of passes) {
		for (let i = 0; i < before.length; i++) {
			const was = before[i]!;
			const j = after.findIndex((now) => pass.match(was, now));
			if (j === -1) continue;
			const now = after[j]!;
			out.push({ ...pass.change(was, now), before: was, after: now });
			before.splice(i, 1);
			after.splice(j, 1);
			i--;
		}
	}
	for (const was of before)
		out.push({ kind: "cancelled", before: was, weeks: was.weeks });
	for (const now of after)
		out.push({ kind: "added", after: now, weeks: now.weeks });
	return out;
};

const correctedBy = (overrides: Overrides) => {
	const keys = Object.keys(overrides);
	return (row: LessonRow | undefined): boolean => {
		if (row === undefined) return false;
		const whole = lessonKey(row);
		return keys.some(
			(key) =>
				key === whole || key === legacyKey(row) || key.startsWith(`${whole}#`),
		);
	};
};

/** Every change in the student's own lessons from `beforeRows` to
 *  `afterRows`, in timetable order of where the lesson is now. */
export const lessonChanges = (
	beforeRows: ReadonlyArray<LessonRow>,
	afterRows: ReadonlyArray<LessonRow>,
	selection: Selection,
	prefs: ChangePrefs,
): ReadonlyArray<LessonChange> => {
	const before = [...printedLessons(beforeRows, selection, prefs)];
	const after = [...printedLessons(afterRows, selection, prefs)];
	// Identical lessons cancel out first; one sheet may print a row twice.
	for (let i = 0; i < before.length; i++) {
		const was = before[i]!;
		const j = after.findIndex(
			(now) => streamOf(now) === streamOf(was) && sameLesson(was, now),
		);
		if (j === -1) continue;
		before.splice(i, 1);
		after.splice(j, 1);
		i--;
	}
	interface Stream {
		readonly before: Array<LessonRow>;
		readonly after: Array<LessonRow>;
	}
	const streams = new Map<string, Stream>();
	const bucket = (row: LessonRow): Stream => {
		const key = streamOf(row);
		const found = streams.get(key);
		if (found) return found;
		const fresh: Stream = { before: [], after: [] };
		streams.set(key, fresh);
		return fresh;
	};
	for (const row of before.sort(order)) bucket(row).before.push(row);
	for (const row of after.sort(order)) bucket(row).after.push(row);
	const corrected = correctedBy(prefs.overrides ?? {});
	return [...streams.values()]
		.flatMap((stream) => pairStream(stream.before, stream.after))
		.map((change) => ({
			...change,
			corrected: corrected(change.before) || corrected(change.after),
		}))
		.sort((a, b) => order((a.after ?? a.before)!, (b.after ?? b.before)!));
};
