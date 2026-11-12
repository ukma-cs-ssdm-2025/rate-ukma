import type { PlanCourse, PlanYear } from "./planTypes";

// Bachelor programme limits. They live here until the backend serves them
// per speciality.
export const PLAN_LIMITS = {
	studyYears: 4,
	totalCredits: 240,
	minProfOrientedCredits: 54,
	maxElectiveCredits: 25,
} as const;

export const CREDITS_FILTER_RANGE: [number, number] = [0.5, 16];
export const CREDITS_FILTER_STEP = 0.5;

export interface PlanSummary {
	totalCredits: number;
	compulsoryCredits: number;
	profOrientedCredits: number;
	electiveCredits: number;
	backupCount: number;
}

export function sumCredits(courses: readonly PlanCourse[]): number {
	return courses.reduce((sum, course) => sum + (course.credits ?? 0), 0);
}

export function sumWeeklyHours(courses: readonly PlanCourse[]): number {
	return courses.reduce((sum, course) => sum + (course.weeklyHours ?? 0), 0);
}

/** Backups stay out of every total: they only replace a main course. */
export function summarizePlan(years: readonly PlanYear[]): PlanSummary {
	const semesters = years.flatMap((year) => year.semesters);
	const main = semesters.flatMap((semester) => semester.main);
	return {
		totalCredits: sumCredits(main),
		compulsoryCredits: sumCredits(
			main.filter((course) => course.kind === "COMPULSORY"),
		),
		profOrientedCredits: sumCredits(
			main.filter((course) => course.kind === "PROF_ORIENTED"),
		),
		electiveCredits: sumCredits(
			main.filter((course) => course.kind === "ELECTIVE"),
		),
		backupCount: semesters.reduce(
			(sum, semester) => sum + semester.backup.length,
			0,
		),
	};
}

export function yearCredits(year: PlanYear): number {
	return year.semesters.reduce(
		(sum, semester) => sum + sumCredits(semester.main),
		0,
	);
}
