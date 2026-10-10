import { Schema } from "effect";

/** The fixed daily time grid every NaUKMA lesson sits on. */
export const BELL_SLOTS = [
	"8:30-9:50",
	"10:00-11:20",
	"11:40-13:00",
	"13:30-14:50",
	"15:00-16:20",
	"16:30-17:50",
	"18:00-19:20",
	"19:30-20:50",
] as const;

export const BellSlot = Schema.Literals(BELL_SLOTS);
export type BellSlot = typeof BellSlot.Type;

export const DAYS = [
	"Понеділок",
	"Вівторок",
	"Середа",
	"Четвер",
	"П'ятниця",
	"Субота",
	"Неділя",
] as const;

export const Day = Schema.Literals(DAYS);
export type Day = typeof Day.Type;

/**
 * A group label. `лекція` means the whole cohort and is not a choice;
 * everything else is one option among several for a discipline.
 */
export const GroupLabel = Schema.NonEmptyString.pipe(
	Schema.brand("GroupLabel"),
);
export type GroupLabel = typeof GroupLabel.Type;

export const LECTURE =
	// SAFETY: the canonical non-empty label the parser emits for whole-cohort rows.
	"лекція" as GroupLabel;

export const DisciplineId = Schema.NonEmptyString.pipe(
	Schema.brand("DisciplineId"),
);
export type DisciplineId = typeof DisciplineId.Type;

/** Teaching weeks are 1..20; a row runs only in the weeks it lists. */
export const Week = Schema.Int.check(
	Schema.isBetween({ minimum: 1, maximum: 20 }),
).pipe(Schema.brand("Week"));
export type Week = typeof Week.Type;

/**
 * One (day, slot, discipline, group, weeks, room) tuple — the atom the parser
 * emits and everything downstream reasons about.
 */
export const LessonRow = Schema.Struct({
	disciplineId: DisciplineId,
	discipline: Schema.NonEmptyString,
	teacher: Schema.optionalKey(Schema.String),
	group: GroupLabel,
	day: Day,
	slot: BellSlot,
	/** The printed time («14:30-16:00») when it is not the bell slot's own; the
	 *  slot is where the lesson sits on the grid, this is when it really runs. */
	time: Schema.optionalKey(Schema.String),
	weeks: Schema.Array(Week),
	room: Schema.optionalKey(Schema.String),
	/** Which published file this row came from, so the UI can link back to it. */
	source: Schema.String,
	/** Set when the student changed this lesson: what the sheet prints. */
	printed: Schema.optionalKey(
		Schema.Struct({
			day: Day,
			slot: BellSlot,
			weeks: Schema.Array(Week),
			room: Schema.optionalKey(Schema.String),
		}),
	),
	/** Set on a lesson the student added by hand: its id in the plan. */
	custom: Schema.optionalKey(Schema.String),
	/** Set on weeks of a printed lesson the student moved apart from the rest. */
	split: Schema.optionalKey(Schema.Boolean),
});
export interface LessonRow extends Schema.Schema.Type<typeof LessonRow> {}

export const isLecture = (row: LessonRow): boolean => row.group === LECTURE;

/** What a lesson is to the student: «лекція», «гр. 3», or their own «своя пара». */
export const groupOf = (row: LessonRow): string =>
	row.custom !== undefined
		? "своя пара"
		: isLecture(row)
			? "лекція"
			: `гр. ${row.group}`;
