import type { LessonRow } from "../domain/schedule.ts";
import { BELL_SLOTS, DAYS, isLecture } from "../domain/schedule.ts";
import { describeWhen, shortName, weekPatternOf } from "../calendar/text.ts";
import { describePlace } from "../domain/place.ts";
import type { WeekDates } from "../calendar/dates.ts";
import type { ScheduleDiff } from "./diff.ts";

export type ChangeKind = "added" | "removed" | "changed" | "moved";

/** One field of a lesson that reads differently in the two readings. */
export interface FieldChange {
	readonly label: string;
	readonly was: string;
	readonly now: string;
}

/** One schedule change, said in words. Added and removed lessons carry
 *  `detail`; changed and moved ones carry the fields that differ. */
export interface ChangeLine {
	readonly kind: ChangeKind;
	readonly key: string;
	readonly disciplineId: string;
	readonly discipline: string;
	/** «лекція» or «гр. N». */
	readonly lesson: string;
	/** Day and bell: «Пт, 4 пара 13:30–14:50». */
	readonly when: string;
	readonly detail: string;
	readonly changes: ReadonlyArray<FieldChange>;
}

export const CHANGE_MARK = {
	added: "+",
	removed: "−",
	changed: "~",
	moved: "→",
} as const;

const weeksOf = (row: LessonRow, weekDates: WeekDates): string =>
	weekPatternOf(row.weeks, weekDates).label;

const placeOf = (row: LessonRow): string =>
	describePlace(row.room) ?? "місце не вказано";

const what = (row: LessonRow, weekDates: WeekDates): string => {
	const place = describePlace(row.room);
	return [weeksOf(row, weekDates), ...(place ? [place] : [])].join(", ");
};

const fields = (before: LessonRow, after: LessonRow, weekDates: WeekDates) => {
	const out: FieldChange[] = [];
	const weeksBefore = weeksOf(before, weekDates);
	const weeksAfter = weeksOf(after, weekDates);
	if (weeksBefore !== weeksAfter)
		out.push({ label: "тижні", was: weeksBefore, now: weeksAfter });
	if (placeOf(before) !== placeOf(after)) {
		out.push({ label: "місце", was: placeOf(before), now: placeOf(after) });
	}
	return out;
};

const order = (a: LessonRow, b: LessonRow): number =>
	DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
	BELL_SLOTS.indexOf(a.slot) - BELL_SLOTS.indexOf(b.slot);

/** The diff as lines a student can read or paste, in timetable order. A
 *  lesson that left one slot and appeared in another with the same weeks and
 *  place is one move, not a removal and an addition. */
export const describeChanges = (
	diff: ScheduleDiff,
	names: ReadonlyMap<string, string>,
	weekDates: WeekDates,
): ReadonlyArray<ChangeLine> => {
	const head = (kind: ChangeKind, row: LessonRow) => ({
		kind,
		key: `${kind} ${row.disciplineId} ${row.group} ${row.day} ${row.slot}`,
		disciplineId: row.disciplineId,
		discipline: shortName(names.get(row.disciplineId) ?? row.discipline),
		lesson: isLecture(row) ? "лекція" : `гр. ${row.group}`,
		when: describeWhen(row),
	});
	const sameLesson = (a: LessonRow, b: LessonRow) =>
		a.disciplineId === b.disciplineId &&
		a.group === b.group &&
		what(a, weekDates) === what(b, weekDates);

	const added = [...diff.added];
	const lines: Array<ChangeLine & { row: LessonRow }> = [];
	for (const row of diff.removed) {
		const to = added.findIndex((candidate) => sameLesson(row, candidate));
		if (to === -1) {
			lines.push({
				...head("removed", row),
				detail: what(row, weekDates),
				changes: [],
				row,
			});
			continue;
		}
		const [target] = added.splice(to, 1);
		lines.push({
			...head("moved", target!),
			detail: what(target!, weekDates),
			changes: [
				{ label: "час", was: describeWhen(row), now: describeWhen(target!) },
			],
			row: target!,
		});
	}
	for (const row of added) {
		lines.push({
			...head("added", row),
			detail: what(row, weekDates),
			changes: [],
			row,
		});
	}
	for (const { before, after } of diff.changed) {
		lines.push({
			...head("changed", after),
			detail: what(after, weekDates),
			changes: fields(before, after, weekDates),
			row: after,
		});
	}
	return lines
		.sort((a, b) => order(a.row, b.row))
		.map(({ row: _row, ...line }) => line);
};

export interface ChangeGroup {
	readonly disciplineId: string;
	readonly discipline: string;
	readonly lines: ReadonlyArray<ChangeLine>;
}

/** Lines under their discipline, disciplines in the order they first appear. */
export const groupChanges = (
	lines: ReadonlyArray<ChangeLine>,
): ReadonlyArray<ChangeGroup> => {
	const groups = new Map<string, ChangeGroup & { lines: ChangeLine[] }>();
	for (const line of lines) {
		const group = groups.get(line.disciplineId);
		if (group) group.lines.push(line);
		else {
			groups.set(line.disciplineId, {
				disciplineId: line.disciplineId,
				discipline: line.discipline,
				lines: [line],
			});
		}
	}
	return [...groups.values()];
};

const lineAsText = (line: ChangeLine): string => {
	const mark = CHANGE_MARK[line.kind];
	if (line.kind === "added" || line.kind === "removed") {
		return `${mark} ${line.lesson}, ${line.when}: ${line.detail}`;
	}
	const changes = line.changes
		.map((c) => `${c.label} ${c.was} → ${c.now}`)
		.join("; ");
	return line.kind === "moved"
		? `${mark} ${line.lesson}: ${line.changes[0]?.was ?? ""} → ${line.changes[0]?.now ?? ""}`
		: `${mark} ${line.lesson}, ${line.when}: ${changes}`;
};

/** The same lines as plain text, for a chat or a note. */
export const changesAsText = (lines: ReadonlyArray<ChangeLine>): string =>
	groupChanges(lines)
		.map((group) =>
			[
				group.discipline,
				...group.lines.map((line) => `  ${lineAsText(line)}`),
			].join("\n"),
		)
		.join("\n");
