import {
	type PlanSlot,
	type PlanYear,
	SemesterTermEnum,
} from "@/lib/api/generated";
import type { PlanTarget } from "./hooks/usePlanActions";

export function isPlanTerm(
	value: string | undefined,
): value is SemesterTermEnum {
	return Object.values(SemesterTermEnum).includes(value as SemesterTermEnum);
}

export function allCourseIds(years: readonly PlanYear[]): Set<string> {
	return new Set(
		years.flatMap((year) =>
			(year.semesters ?? []).flatMap((semester) =>
				[...(semester.main ?? []), ...(semester.backup ?? [])].map(
					(course) => course.course_id ?? "",
				),
			),
		),
	);
}

export interface PlannedPlace {
	target: PlanTarget;
	slot: PlanSlot;
	/** Taken or mandatory, so the student cannot move or drop it. */
	locked: boolean;
}

/** The first semester a course sits in, if it is in the plan at all. */
export function findPlannedCourse(
	years: readonly PlanYear[],
	courseId: string,
): PlannedPlace | null {
	for (const year of years) {
		for (const semester of year.semesters ?? []) {
			const target = {
				study_year: year.study_year ?? 0,
				semester_term: semester.semester_term ?? "FALL",
			};
			const main = semester.main?.find((item) => item.course_id === courseId);
			if (main) {
				return { target, slot: "MAIN", locked: Boolean(main.is_mandatory) };
			}
			if (semester.backup?.some((item) => item.course_id === courseId)) {
				return { target, slot: "BACKUP", locked: false };
			}
		}
	}
	return null;
}
