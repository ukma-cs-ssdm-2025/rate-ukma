import { Schema } from "effect";
import type { Offering } from "./offering.ts";
import {
	BellSlot,
	Day,
	LECTURE,
	Week,
	type DisciplineId,
	type LessonRow,
} from "./schedule.ts";

const Text = (max: number) => Schema.String.check(Schema.isMaxLength(max));

/**
 * A lesson the student added by hand because no sheet has it: the thesis
 * supervisor's weekly meeting, a course whose faculty never published a
 * file, an extra pair a teacher arranged. It joins the plan as a lesson
 * the student attends, so it clashes, exports and shares like any other.
 */
export const CustomLesson = Schema.Struct({
	id: Schema.NonEmptyString.check(Schema.isMaxLength(40)),
	name: Schema.NonEmptyString.check(Schema.isMaxLength(300)),
	day: Day,
	slot: BellSlot,
	weeks: Schema.Array(Week).check(Schema.isMinLength(1)),
	room: Schema.optionalKey(Text(80)),
	teacher: Schema.optionalKey(Text(120)),
	/** The ІНП line it stands in for, when САЗ lists the course but no sheet does. */
	courseId: Schema.optionalKey(Text(40)),
});
export interface CustomLesson extends Schema.Schema.Type<typeof CustomLesson> {}

export const CustomLessons = Schema.Array(CustomLesson).check(
	Schema.isMaxLength(100),
);
export type CustomLessons = typeof CustomLessons.Type;

/** One discipline per name: two lessons the student called the same are one
 *  subject with two pairs a week. */
export const customId = (name: string): DisciplineId =>
	// SAFETY: a non-empty prefix keeps the id non-empty, which is the brand's only rule.
	`власна:${name.trim()}` as DisciplineId;

export const isCustomOffering = (offering: Offering): boolean =>
	offering.disciplineId.startsWith("власна:");

/** A row while its optional room and teacher are still being set. */
type RowDraft = { -readonly [K in keyof LessonRow]: LessonRow[K] };

const rowOf = (lesson: CustomLesson): LessonRow => {
	const row: RowDraft = {
		disciplineId: customId(lesson.name),
		discipline: lesson.name.trim(),
		group: LECTURE,
		day: lesson.day,
		slot: lesson.slot,
		weeks: lesson.weeks,
		source: "",
		custom: lesson.id,
	};
	const room = lesson.room?.trim();
	if (room) row.room = room;
	const teacher = lesson.teacher?.trim();
	if (teacher) row.teacher = teacher;
	return row;
};

/** The student's own lessons as offerings with nothing to choose: every
 *  lesson is attended, like a lecture. */
export const customOfferings = (
	lessons: CustomLessons,
): ReadonlyArray<Offering> => {
	const byId = new Map<DisciplineId, LessonRow[]>();
	for (const lesson of lessons) {
		const row = rowOf(lesson);
		const bucket = byId.get(row.disciplineId);
		if (bucket) bucket.push(row);
		else byId.set(row.disciplineId, [row]);
	}
	return [...byId].map(([disciplineId, rows]) => ({
		disciplineId,
		discipline: rows[0]!.discipline,
		lectures: rows,
		groups: {},
	}));
};
