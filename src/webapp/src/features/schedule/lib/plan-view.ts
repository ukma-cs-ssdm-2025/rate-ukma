import type {
	CustomLessons,
	DisciplineId,
	InpResolution,
	Offering,
	Overrides,
	Plan,
	PlanLessons,
	Selection,
	Week,
} from "@/features/schedule/core";
import {
	customOfferings,
	isComplete,
	plan,
	withOverrides,
} from "@/features/schedule/core";
import type { Conflicts } from "@/features/schedule/core";
import { conflictsOf } from "@/features/schedule/core";
import type { Semester } from "@/features/schedule/lib/data";
import type { ViewMode } from "@/features/schedule/stores/ui";
import { withForced } from "@/features/schedule/core";

export interface PlanDraft {
	readonly picked: ReadonlyArray<DisciplineId>;
	readonly selection: Selection;
	/** Lessons corrected by hand: applied here, so the solver and the grid see them moved. */
	readonly overrides: Overrides;
	/** Lessons added by hand: they join the plan like lectures the student attends. */
	readonly custom: CustomLessons;
	/** Disciplines the student does not attend: listed, but out of the solve. */
	readonly hidden: ReadonlyArray<DisciplineId>;
}

export interface PlanView {
	/** Every discipline in the plan, hidden ones included, corrections applied. */
	readonly pickedOfferings: ReadonlyArray<Offering>;
	readonly result: Plan;
	/** What the student is actually taking: their picks plus every forced group. */
	readonly effective: Selection;
	readonly conflicts: Conflicts;
	readonly clashCount: number;
	readonly complete: boolean;
	readonly remaining: number;
}

/** What the timetable grid reads: picks, solution, labels, frame and week.
 *  The planner owns this plus its editing half; a shared page builds it
 *  read-only, with a no-op behind the stream switch the locked grid hides. */
export interface Timetable {
	readonly pickedOfferings: ReadonlyArray<Offering>;
	readonly result: Plan;
	readonly effective: Selection;
	readonly lessons: PlanLessons;
	readonly semester: Semester | undefined;
	readonly displayNames: ReadonlyMap<DisciplineId, string>;
	readonly weeks: ReadonlyArray<Week>;
	readonly week: Week | undefined;
	readonly span: { readonly start: string; readonly end: string } | undefined;
	readonly thisWeek: Week | undefined;
	readonly shownView: ViewMode;
	readonly inp: InpResolution | undefined;
	readonly switchStream: (from: DisciplineId, to: DisciplineId) => void;
}

/** The whole Stage-1 solve in one call: offerings, forced groups, clashes,
 *  and whether every discipline with a choice has one. */
export const selectPlan = (semester: Semester, draft: PlanDraft): PlanView => {
	const picked = new Set(draft.picked);
	const pickedOfferings = withOverrides(
		[
			...semester.offerings.filter((offering) =>
				picked.has(offering.disciplineId),
			),
			...customOfferings(draft.custom),
		],
		draft.overrides,
	);
	// Hiding is the student's answer to «I do not attend this»: a hidden
	// discipline neither clashes with the rest nor waits for a group.
	const hidden = new Set(draft.hidden);
	const attended = pickedOfferings.filter(
		(offering) => !hidden.has(offering.disciplineId),
	);
	const result = plan(attended);
	const effective = withForced(draft.selection, result);
	const conflicts = conflictsOf(attended, result, effective);
	// isComplete is over offerings, candidates are all groups by construction,
	// so the length guard is what keeps an empty plan from reading as complete.
	const complete = attended.length > 0 && isComplete(attended, effective);
	const remaining = result.disciplines.filter(
		(d) => d.candidates.length > 0 && effective[d.disciplineId] === undefined,
	).length;
	return {
		pickedOfferings,
		result,
		effective,
		conflicts,
		clashCount: conflicts.lectures.length + conflicts.chosen.length,
		complete,
		remaining,
	};
};
