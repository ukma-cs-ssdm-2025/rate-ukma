import type { DisciplineId, LessonRow } from "../domain/schedule.ts";
import type { Offering } from "../domain/offering.ts";
import type { Selection } from "../domain/selection.ts";
import { withOverrides, type Overrides } from "../domain/overrides.ts";
import { rowsOf } from "../solver/plan.ts";
import { labelsOf } from "./text.ts";

/** What the student asked the timetable to look like, beyond the picks. */
export interface PlanPrefs {
	/** Disciplines hidden with the eye: not on the grid, not in any calendar. */
	readonly hidden: ReadonlyArray<DisciplineId>;
	/** Long names as their initials (БПП) everywhere a lesson is named. */
	readonly shortNames: boolean;
	/** Lessons the student moved off the sheet's time; applied before anything else. */
	readonly overrides?: Overrides;
	/** ІНП titles per discipline, when the sheet name is truncated or wrong. */
	readonly names?: ReadonlyMap<DisciplineId, string>;
}

export interface PlanLessons {
	/** The offerings the timetable is made of, hidden ones already gone. */
	readonly offerings: ReadonlyArray<Offering>;
	/** Every lecture and every chosen group's lesson, in offering order. */
	readonly rows: ReadonlyArray<LessonRow>;
	/** What each discipline is called wherever a lesson is shown. */
	readonly labels: ReadonlyMap<string, string>;
}

/**
 * The student's timetable, once. The grid, the calendar feed, the .ics
 * download and the text copy all render this and nothing else, so a
 * preference honoured in one place is honoured in every place.
 */
export const planLessons = (
	offerings: ReadonlyArray<Offering>,
	selection: Selection,
	prefs: PlanPrefs,
): PlanLessons => {
	const shown = withOverrides(
		offerings.filter(
			(offering) => !prefs.hidden.includes(offering.disciplineId),
		),
		prefs.overrides ?? {},
	);
	return {
		offerings: shown,
		rows: rowsOf(shown, selection),
		labels: labelsOf(shown, prefs.shortNames, prefs.names),
	};
};
