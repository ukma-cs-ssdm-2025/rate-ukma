import { Schema } from "effect";
import type { Offering } from "./offering.ts";
import { BellSlot, Day, Week, type LessonRow } from "./schedule.ts";

/**
 * A lesson the student corrected because the sheet is wrong or stale: the
 * teacher moved the pair, changed the room, runs it only in some weeks or
 * dropped it. Keyed by the lesson as the sheet prints it (`lessonKey`), or
 * by one week of it (`occurrenceKey`) when only that week changed, so a
 * republished sheet that fixes the time drops the override on its own (the
 * key no longer matches).
 */
export const Override = Schema.Struct({
	day: Day,
	slot: BellSlot,
	/** The room the student knows; an empty string clears the sheet's. */
	room: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(80))),
	/** The weeks it really runs. An empty list is a lesson that is not held. */
	weeks: Schema.optionalKey(Schema.Array(Week)),
});
export type Override = typeof Override.Type;

export const Overrides = Schema.Record(Schema.String, Override);
export type Overrides = typeof Overrides.Type;

/** The identity of a lesson as printed: discipline, group, day, pair and
 *  weeks. Weeks are part of it because one sheet can print the same pair
 *  twice for one group (weeks 2–12, and a separate week 13), and a
 *  correction of one must not touch the other. */
export const lessonKey = (row: LessonRow): string => {
	const origin = row.printed ?? row;
	return `${legacyKey(row)}|${origin.weeks.join(",")}`;
};

/** The key moves were saved under before weeks joined it. Still read, so a
 *  lesson moved then keeps its place; a new edit replaces it. */
export const legacyKey = (row: LessonRow): string => {
	const origin = row.printed ?? row;
	return `${row.disciplineId}|${row.group}|${origin.day}|${origin.slot}`;
};

/** The whole-lesson correction of a printed row, under either key. */
export const overrideOf = (
	row: LessonRow,
	overrides: Overrides,
): Override | undefined =>
	overrides[lessonKey(row)] ?? overrides[legacyKey(row)];

/** One week of a printed lesson: the teacher moved or cancelled just that
 *  occurrence. Its override ignores `weeks` unless it is empty (not held). */
export const occurrenceKey = (row: LessonRow, week: Week): string =>
	`${lessonKey(row)}#${week}`;

/** A corrected row, and the sheet's values it keeps, while their optional
 *  fields are still being set. */
type RowDraft = { -readonly [K in keyof LessonRow]: LessonRow[K] };
type Printed = NonNullable<LessonRow["printed"]>;
type PrintedDraft = { -readonly [K in keyof Printed]: Printed[K] };

export const sameWeeks = (
	a: ReadonlyArray<Week>,
	b: ReadonlyArray<Week>,
): boolean =>
	a.length === b.length && a.every((week, index) => week === b[index]);

/** True when the override would leave the printed lesson as it is. */
export const isNoop = (row: LessonRow, target: Override): boolean =>
	target.day === row.day &&
	target.slot === row.slot &&
	(target.weeks === undefined || sameWeeks(target.weeks, row.weeks)) &&
	(target.room === undefined || target.room === (row.room ?? ""));

/** The printed lesson as the student corrected it, with the sheet's values
 *  kept in `printed` for undo. The editor picks a pair, not a clock, so a
 *  lesson moved to another pair runs on that bell and drops its printed time. */
export const correctedRow = (row: LessonRow, target: Override): LessonRow => {
	if (isNoop(row, target)) return row;
	const { room: printedRoom, time, ...rest } = row;
	const printed: PrintedDraft = {
		day: row.day,
		slot: row.slot,
		weeks: row.weeks,
	};
	if (printedRoom !== undefined) printed.room = printedRoom;
	const corrected: RowDraft = {
		...rest,
		day: target.day,
		slot: target.slot,
		weeks: target.weeks ?? row.weeks,
		printed,
	};
	const room = target.room ?? printedRoom;
	if (room) corrected.room = room;
	if (time !== undefined && target.slot === row.slot) corrected.time = time;
	return corrected;
};

/** The sheet's own values of a row, corrected or not. */
const printedOf = (row: LessonRow): Printed => {
	if (row.printed) return row.printed;
	const sheet: PrintedDraft = {
		day: row.day,
		slot: row.slot,
		weeks: row.weeks,
	};
	if (row.room !== undefined) sheet.room = row.room;
	return sheet;
};

/** Some weeks of the printed lesson where the student says they happen:
 *  another day, pair or room in weeks 8–14, say. `split` marks the part;
 *  `printed` keeps the whole lesson as the sheet has it, so the part's key
 *  is still the lesson's key. */
export const correctedPart = (
	row: LessonRow,
	weeks: ReadonlyArray<Week>,
	target: Override,
): LessonRow => {
	const { room: _room, time, ...rest } = row;
	const part: RowDraft = {
		...rest,
		day: target.day,
		slot: target.slot,
		weeks,
		split: true,
		printed: printedOf(row),
	};
	const room = target.room ?? row.room;
	if (room) part.room = room;
	if (time !== undefined && target.slot === row.slot) part.time = time;
	return part;
};

/** The weeks of one printed lesson the student moved on their own, grouped
 *  by where they moved: weeks with the same day, pair and room are one part.
 *  Cancelled weeks group too, under `weeks: []`. */
export const partsOf = (
	row: LessonRow,
	runs: ReadonlyArray<Week>,
	overrides: Overrides,
): ReadonlyArray<{
	readonly target: Override;
	readonly weeks: ReadonlyArray<Week>;
}> => {
	const parts = new Map<string, { target: Override; weeks: Week[] }>();
	for (const week of runs) {
		const target = overrides[occurrenceKey(row, week)];
		if (!target) continue;
		const cancelled = target.weeks?.length === 0;
		const id = `${target.day}|${target.slot}|${target.room ?? ""}|${cancelled}`;
		const part = parts.get(id);
		if (part) part.weeks.push(week);
		else parts.set(id, { target, weeks: [week] });
	}
	return [...parts.values()];
};

/** The printed row with its whole-lesson override, then the weeks the
 *  student moved on their own split off into parts. A lesson left with no
 *  weeks is not held and is gone from every renderer. */
const expand = (
	row: LessonRow,
	overrides: Overrides,
): ReadonlyArray<LessonRow> => {
	const whole = overrideOf(row, overrides);
	const base = whole ? correctedRow(row, whole) : row;
	const parts = partsOf(row, base.weeks, overrides);
	if (whole === undefined && parts.length === 0) return [row];
	const moved = new Set(parts.flatMap((part) => part.weeks));
	const kept = base.weeks.filter((week) => !moved.has(week));
	// The rest keeps the sheet's values too, so its key and the editor's
	// «Як у файлі» still see the whole lesson, not the weeks left over.
	const rest =
		kept.length === base.weeks.length
			? base
			: { ...base, weeks: kept, printed: printedOf(row) };
	return [
		...(rest.weeks.length > 0 ? [rest] : []),
		...parts
			.filter((part) => part.target.weeks?.length !== 0)
			.map((part) => correctedPart(base, part.weeks, part.target)),
	];
};

const applyAll = (rows: ReadonlyArray<LessonRow>, overrides: Overrides) =>
	rows.flatMap((row) => expand(row, overrides));

/** The offerings with every override applied, so the solver, the grid and
 *  every calendar reason about the lessons where the student says they are. */
export const withOverrides = (
	offerings: ReadonlyArray<Offering>,
	overrides: Overrides,
): ReadonlyArray<Offering> => {
	if (Object.keys(overrides).length === 0) return offerings;
	return offerings.map((offering) => ({
		...offering,
		lectures: applyAll(offering.lectures, overrides),
		groups: Object.fromEntries(
			Object.entries(offering.groups).map(([group, rows]) => [
				group,
				applyAll(rows, overrides),
			]),
		),
	}));
};

/** One correction as the student made it: the lesson the sheet prints,
 *  what they changed it to, and the row the editor opens on. A part (some
 *  weeks of the lesson) is one correction for all its weeks. `printed` is
 *  undefined when the sheet no longer has that lesson; `applies` is false
 *  when nothing on the grid follows it any more. */
export interface Correction {
	/** Every stored key behind it: one for the whole lesson, one per week of a part. */
	readonly keys: ReadonlyArray<string>;
	readonly offering: Offering;
	readonly printed: LessonRow | undefined;
	/** Set for a part: the weeks it covers. */
	readonly weeks: ReadonlyArray<Week> | undefined;
	readonly target: Override;
	readonly applies: boolean;
	/** The lesson as it renders now, for the editor to open on. */
	readonly current: LessonRow | undefined;
}

/** Every override that belongs to one of these (unchanged) offerings, in
 *  offering order, plus the ones whose printed lesson has since vanished. */
export const correctionsOf = (
	offerings: ReadonlyArray<Offering>,
	overrides: Overrides,
): ReadonlyArray<Correction> => {
	const out: Correction[] = [];
	const seen = new Set<string>();
	for (const offering of offerings) {
		const rows = [
			...offering.lectures,
			...Object.values(offering.groups).flat(),
		];
		for (const row of rows) {
			const key = [lessonKey(row), legacyKey(row)].find(
				(k) => overrides[k] !== undefined,
			);
			const whole = key === undefined ? undefined : overrides[key];
			const base = whole ? correctedRow(row, whole) : row;
			if (key !== undefined && whole !== undefined && !seen.has(key)) {
				seen.add(key);
				out.push({
					keys: [key],
					offering,
					printed: row,
					weeks: undefined,
					target: whole,
					applies: true,
					current: base,
				});
			}
			// A week moves on its own only while the lesson still runs then;
			// the ones outside are listed, but say they no longer apply.
			const runs = new Set(base.weeks);
			const weeks = [...new Set([...row.weeks, ...base.weeks])].sort(
				(a, b) => a - b,
			);
			for (const part of partsOf(row, weeks, overrides)) {
				const keys = part.weeks.map((week) => occurrenceKey(row, week));
				if (keys.every((k) => seen.has(k))) continue;
				for (const k of keys) seen.add(k);
				out.push({
					keys,
					offering,
					printed: row,
					weeks: part.weeks,
					target: part.target,
					applies: part.weeks.some((week) => runs.has(week)),
					current: correctedPart(base, part.weeks, part.target),
				});
			}
		}
		for (const [key, target] of Object.entries(overrides)) {
			if (seen.has(key) || !key.startsWith(`${offering.disciplineId}|`))
				continue;
			seen.add(key);
			out.push({
				keys: [key],
				offering,
				printed: undefined,
				weeks: undefined,
				target,
				applies: false,
				current: undefined,
			});
		}
	}
	return out;
};
