import type {
	BellSlot,
	Day,
	DisciplineId,
	GroupLabel,
	LessonRow,
	Week,
} from "../domain/schedule.ts";
import { isLecture } from "../domain/schedule.ts";
import type { Offering } from "../domain/offering.ts";
import type { Selection } from "../domain/selection.ts";
import type { SlotTime } from "../calendar/dates.ts";
import { findClashes, sharedTime, type Clash } from "./clash.ts";
import { plan, rowsOf, type Plan } from "./plan.ts";

export interface ConflictSide {
	readonly disciplineId: DisciplineId;
	readonly discipline: string;
	/** undefined for a lecture — the whole cohort, no choice involved. */
	readonly group: GroupLabel | undefined;
}

/** Two lessons at the same time, with every week they collide in. */
export interface Conflict {
	readonly a: ConflictSide;
	readonly b: ConflictSide;
	readonly day: Day;
	/** Where the first lesson sits on the grid. */
	readonly slot: BellSlot;
	/** The minutes both lessons run, which is when they really collide. */
	readonly time: SlotTime;
	readonly weeks: ReadonlyArray<Week>;
}

export interface Conflicts {
	/** Lectures of two picked disciplines at one time: no group choice helps. */
	readonly lectures: ReadonlyArray<Conflict>;
	/** Overlaps inside what the student actually chose, a group against anything. */
	readonly chosen: ReadonlyArray<Conflict>;
	/**
	 * Disciplines whose removal makes the rest solvable. Filled only when no
	 * clash-free combination exists, so the student knows what to drop or defer.
	 */
	readonly culprits: ReadonlyArray<DisciplineId>;
}

const sideOf = (row: LessonRow): ConflictSide => ({
	disciplineId: row.disciplineId,
	discipline: row.discipline,
	group: isLecture(row) ? undefined : row.group,
});

const keyOf = (side: ConflictSide): string =>
	`${side.disciplineId}|${side.group ?? ""}`;

/** Rows of one group span several sheets; one conflict per (pair, day, time). */
export const merge = (
	clashes: ReadonlyArray<Clash>,
): ReadonlyArray<Conflict> => {
	const byKey = new Map<string, { conflict: Conflict; weeks: Set<Week> }>();
	for (const clash of clashes) {
		const [a, b] = [sideOf(clash.a), sideOf(clash.b)];
		// SAFETY: a clash is an overlap, so the two rows share some minutes.
		const time = sharedTime(clash.a, clash.b)!;
		const key = [keyOf(a), keyOf(b), clash.a.day, time.start, time.end].join(
			"|",
		);
		const entry = byKey.get(key);
		if (entry) {
			for (const week of clash.weeks) entry.weeks.add(week);
			continue;
		}
		byKey.set(key, {
			conflict: { a, b, day: clash.a.day, slot: clash.a.slot, time, weeks: [] },
			weeks: new Set(clash.weeks),
		});
	}
	return [...byKey.values()].map(({ conflict, weeks }) => ({
		...conflict,
		weeks: [...weeks].sort((x, y) => x - y),
	}));
};

export const conflictsOf = (
	offerings: ReadonlyArray<Offering>,
	result: Plan,
	selection: Selection,
): Conflicts => {
	const lectures = merge(result.unavoidable);
	const chosen = merge(
		findClashes(rowsOf(offerings, selection)).filter(
			(clash) => !(isLecture(clash.a) && isLecture(clash.b)),
		),
	);
	// O(N x solve): one full plan() per offering. Deliberate — a single
	// unsatisfiable-core pass would be cheaper; do that only if this shows up
	// in profiles, not before.
	const culprits = result.satisfiable
		? []
		: offerings
				.filter(
					(offering) =>
						plan(offerings.filter((other) => other !== offering)).satisfiable,
				)
				.map((offering) => offering.disciplineId);
	return { lectures, chosen, culprits };
};
