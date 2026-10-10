import {
	groupLabels,
	isLectureOnly,
	type Offering,
} from "../domain/offering.ts";
import type { Selection } from "../domain/selection.ts";
import type {
	DisciplineId,
	GroupLabel,
	LessonRow,
} from "../domain/schedule.ts";
import { findClashes, overlaps, sharedWeeks, type Clash } from "./clash.ts";

export interface DisciplinePlan {
	readonly disciplineId: DisciplineId;
	readonly discipline: string;
	/** Every group published for this discipline. */
	readonly candidates: ReadonlyArray<GroupLabel>;
	/** Groups that survive in at least one complete clash-free assignment. */
	readonly feasible: ReadonlyArray<GroupLabel>;
	/** Groups with no free places — infeasible regardless of the timetable. */
	readonly full: ReadonlyArray<GroupLabel>;
	/**
	 * True when the student has no real choice left: several groups were
	 * published but only one can actually be taken alongside the rest.
	 */
	readonly forced: boolean;
}

/**
 * Live enrolment numbers from САЗ, injected so `plan` stays pure. A group with
 * no free places cannot be joined, so it is infeasible, not merely clash-free.
 * Capacity moves during the registration window — re-read it, never cache.
 */
export type Capacity = ReadonlyMap<
	DisciplineId,
	ReadonlyMap<GroupLabel, { readonly free: number }>
>;

export interface Plan {
	readonly disciplines: ReadonlyArray<DisciplinePlan>;
	/** Clashes between mandatory lectures — no group choice can avoid these. */
	readonly unavoidable: ReadonlyArray<Clash>;
	/** False when no combination of groups is clash-free. */
	readonly satisfiable: boolean;
}

const rowsFor = (
	offering: Offering,
	group: GroupLabel,
): ReadonlyArray<LessonRow> => offering.groups[group] ?? [];

/** A group is viable on its own only if it misses every mandatory lecture. */
const clashesWithFixed = (
	rows: ReadonlyArray<LessonRow>,
	fixed: ReadonlyArray<LessonRow>,
): boolean => rows.some((row) => fixed.some((other) => overlaps(row, other)));

/**
 * Stage 1. Works out, for every discipline, which groups can still be taken
 * given all the others — and therefore which choices are already forced.
 *
 * Lectures are mandatory, so they are fixed before any search: a group that
 * hits a lecture is eliminated outright, which prunes most of the space before
 * backtracking begins.
 */
export const plan = (
	offerings: ReadonlyArray<Offering>,
	capacity?: Capacity,
): Plan => {
	const fixed = offerings.flatMap((offering) => offering.lectures);
	const unavoidable = findClashes(fixed);

	const selectable = offerings.filter((offering) => !isLectureOnly(offering));

	const isFull = (disciplineId: DisciplineId, group: GroupLabel): boolean => {
		const free = capacity?.get(disciplineId)?.get(group)?.free;
		return free !== undefined && free <= 0;
	};

	// Groups that survive contact with the mandatory lectures and have places.
	const viable = new Map<DisciplineId, ReadonlyArray<GroupLabel>>();
	for (const offering of selectable) {
		viable.set(
			offering.disciplineId,
			groupLabels(offering).filter(
				(group) =>
					!isFull(offering.disciplineId, group) &&
					!clashesWithFixed(rowsFor(offering, group), fixed),
			),
		);
	}

	// Order by fewest options first so contradictions surface early.
	const ordered = [...selectable].sort(
		(a, b) =>
			(viable.get(a.disciplineId)?.length ?? 0) -
			(viable.get(b.disciplineId)?.length ?? 0),
	);

	const search = (
		index: number,
		chosen: ReadonlyArray<LessonRow>,
		pinned:
			| { readonly disciplineId: DisciplineId; readonly group: GroupLabel }
			| undefined,
	): boolean => {
		if (index === ordered.length) return true;
		const offering = ordered[index]!;
		const options =
			pinned && pinned.disciplineId === offering.disciplineId
				? [pinned.group]
				: (viable.get(offering.disciplineId) ?? []);

		for (const group of options) {
			const rows = rowsFor(offering, group);
			if (clashesWithFixed(rows, chosen)) continue;
			if (search(index + 1, [...chosen, ...rows], pinned)) return true;
		}
		return false;
	};

	const satisfiable = unavoidable.length === 0 && search(0, fixed, undefined);

	const disciplines = offerings.map((offering): DisciplinePlan => {
		const candidates = groupLabels(offering);
		const feasible = satisfiable
			? (viable.get(offering.disciplineId) ?? []).filter((group) =>
					search(0, fixed, { disciplineId: offering.disciplineId, group }),
				)
			: [];
		return {
			disciplineId: offering.disciplineId,
			discipline: offering.discipline,
			candidates,
			feasible,
			full: candidates.filter((group) => isFull(offering.disciplineId, group)),
			forced: candidates.length > 1 && feasible.length === 1,
		};
	});

	return { disciplines, unavoidable, satisfiable };
};

/**
 * Why a group cannot be taken: the concrete lecture rows it collides with.
 * Empty when the group only fails indirectly (no complete assignment survives)
 * — the UI words that case differently.
 */
export const explainGroup = (
	offerings: ReadonlyArray<Offering>,
	disciplineId: DisciplineId,
	group: GroupLabel,
): ReadonlyArray<Clash> => {
	const offering = offerings.find(
		(entry) => entry.disciplineId === disciplineId,
	);
	if (!offering) return [];
	const fixed = offerings
		.filter((entry) => entry.disciplineId !== disciplineId)
		.flatMap((entry) => entry.lectures);
	const clashes: Array<Clash> = [];
	for (const row of rowsFor(offering, group)) {
		for (const other of fixed) {
			if (overlaps(row, other)) {
				clashes.push({ a: row, b: other, weeks: sharedWeeks(row, other) });
			}
		}
	}
	return clashes;
};

/** Rows a concrete selection actually puts in the student's week. */
export const rowsOf = (
	offerings: ReadonlyArray<Offering>,
	selection: Selection,
): ReadonlyArray<LessonRow> =>
	offerings.flatMap((offering) => {
		const group = selection[offering.disciplineId];
		return [...offering.lectures, ...(group ? rowsFor(offering, group) : [])];
	});

/** A selection is complete when every selectable discipline has a group. */
export const isComplete = (
	offerings: ReadonlyArray<Offering>,
	selection: Selection,
): boolean =>
	offerings
		.filter((offering) => !isLectureOnly(offering))
		.every((offering) => selection[offering.disciplineId] !== undefined);
