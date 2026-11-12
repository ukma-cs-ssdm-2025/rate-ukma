import type { TypeKindEnum } from "@/lib/api/generated";

export type PlanTerm = "FALL" | "SPRING" | "SUMMER";

export const PLAN_TERMS: readonly PlanTerm[] = ["FALL", "SPRING", "SUMMER"];

export type PlanCourseKind = TypeKindEnum;

/** A course the student can pick, so never a compulsory one. */
export type ChoiceKind = Exclude<PlanCourseKind, "COMPULSORY">;

export type PlanSlot = "main" | "backup";

export interface PlanCourse {
	courseId: string;
	title: string;
	kind: PlanCourseKind;
	facultyName: string | null;
	/** Null until the offering is known, so it adds nothing to the totals. */
	credits: number | null;
	weeklyHours: number | null;
	/** Taken per САЗ, so the student cannot drop it from the plan. */
	locked?: boolean;
}

export interface PlanSemesterCourses {
	main: PlanCourse[];
	backup: PlanCourse[];
}

export interface PlanSemester extends PlanSemesterCourses {
	term: PlanTerm;
	/** The final year has no summer semester. */
	unavailable: boolean;
}

/** Past years are read-only, the current one follows САЗ, later ones are the plan. */
export type PlanYearStatus = "done" | "current" | "planned";

export interface PlanYear {
	studyYear: number;
	academicYearStart: number;
	status: PlanYearStatus;
	semesters: PlanSemester[];
}

/** Where a course goes when picked: one semester of one study year. */
export interface PlanTarget {
	studyYear: number;
	term: PlanTerm;
}
