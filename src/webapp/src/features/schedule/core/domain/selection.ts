import { Schema } from "effect";
import { DisciplineId, GroupLabel } from "./schedule.ts";
import type { Offering } from "./offering.ts";
import type { Plan } from "../solver/plan.ts";

/**
 * Stage 2 shape: one chosen group per discipline. Lecture-only disciplines are
 * absent from the map rather than holding a sentinel.
 */
export const Selection = Schema.Record(DisciplineId, GroupLabel);
export interface Selection extends Schema.Schema.Type<typeof Selection> {}

export const empty: Selection = {};

export const withGroup = (
	selection: Selection,
	disciplineId: DisciplineId,
	group: GroupLabel,
): Selection => ({ ...selection, [disciplineId]: group });

export const without = (
	selection: Selection,
	disciplineId: DisciplineId,
): Selection => {
	const { [disciplineId]: _removed, ...rest } = selection;
	return rest;
};

/** Groups САЗ recorded per discipline — the Stage 3 fact plans start from. */
export type RegisteredGroups = Readonly<Record<DisciplineId, GroupLabel>>;

/** САЗ's recorded group fills every discipline the student has not chosen a
 *  group for; a choice already made stays, even when it disagrees with САЗ. */
export const withRegistered = (
	selection: Selection,
	registered: RegisteredGroups,
	offerings: ReadonlyArray<Offering>,
): Selection => {
	let next = selection;
	for (const [disciplineId, group] of Object.entries(registered)) {
		// SAFETY: registered is keyed by DisciplineId by construction (registeredByDisciplineOf).
		const id = disciplineId as DisciplineId;
		if (next[id] !== undefined) continue;
		const offering = offerings.find((o) => o.disciplineId === id);
		if (offering?.groups[group]) next = withGroup(next, id, group);
	}
	return next;
};

/** A discipline with a single group is not a decision: that group is chosen.
 *  Everything else stays as the student left it, including «no group» in a
 *  discipline where only one group still fits: the grid strikes the others
 *  and the hint names the one that fits, but the click is theirs. */
export const withForced = (selection: Selection, result: Plan): Selection => {
	let next = selection;
	for (const entry of result.disciplines) {
		if (next[entry.disciplineId] !== undefined) continue;
		if (entry.candidates.length === 1) {
			next = withGroup(next, entry.disciplineId, entry.candidates[0]!);
		}
	}
	return next;
};

// Helpers that keep the branded-id casts in one place.
export const brandIds = (values: ReadonlyArray<string>) =>
	// SAFETY: plan fields round-trip through our own PUT /api/me/plan writes.
	values as ReadonlyArray<DisciplineId>;
export const brandRecord = (values: Readonly<Record<string, string>>) =>
	// SAFETY: same round-trip provenance as brandIds.
	values as Readonly<Record<DisciplineId, GroupLabel>>;
