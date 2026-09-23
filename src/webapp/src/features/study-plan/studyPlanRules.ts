import type {
	PlanCourse,
	PlanCourseCategory,
	PlanSeason,
	PlanSemester,
	PlanYear,
} from "./studyPlanTypes";

export const HOURS_PER_CREDIT = 30;
export const BACHELOR_TOTAL_CREDITS = 240;
export const PROF_ORIENTED_MIN_CREDITS = 54;
export const ELECTIVE_MAX_CREDITS = 25;
export const YEAR_MIN_CREDITS = 58;
export const YEAR_MAX_CREDITS = 62;

export const SEASON_LABELS: Record<PlanSeason, string> = {
	FALL: "Осінній семестр",
	SPRING: "Весняний семестр",
	SUMMER: "Літній семестр",
};

export const CATEGORY_LABELS: Record<PlanCourseCategory, string> = {
	COMPULSORY: "Нормативна",
	PROF_ORIENTED: "Вибіркова професійна",
	ELECTIVE: "Вільного вибору",
};

export function creditsToHours(credits: number): number {
	return credits * HOURS_PER_CREDIT;
}

export function sumCredits(courses: readonly PlanCourse[]): number {
	return courses.reduce((total, course) => total + course.credits, 0);
}

export function getSemesterCredits(semester: PlanSemester): number {
	return sumCredits(semester.courses);
}

export function getYearCredits(year: PlanYear): number {
	return year.semesters.reduce(
		(total, semester) => total + getSemesterCredits(semester),
		0,
	);
}

export type CategoryCredits = Record<PlanCourseCategory, number>;

export function getCategoryCredits(
	years: readonly PlanYear[],
): CategoryCredits {
	const result: CategoryCredits = {
		COMPULSORY: 0,
		PROF_ORIENTED: 0,
		ELECTIVE: 0,
	};
	for (const year of years) {
		for (const semester of year.semesters) {
			for (const course of semester.courses) {
				result[course.category] += course.credits;
			}
		}
	}
	return result;
}

export type YearLoadStatus =
	| { kind: "ok" }
	| { kind: "under"; missing: number }
	| { kind: "over"; excess: number };

export function getYearLoadStatus(credits: number): YearLoadStatus {
	if (credits < YEAR_MIN_CREDITS) {
		return { kind: "under", missing: YEAR_MIN_CREDITS - credits };
	}
	if (credits > YEAR_MAX_CREDITS) {
		return { kind: "over", excess: credits - YEAR_MAX_CREDITS };
	}
	return { kind: "ok" };
}

export interface PlanSummary {
	totalCredits: number;
	remainingCredits: number;
	excessCredits: number;
	categories: CategoryCredits;
	profOrientedMissing: number;
	electiveAvailable: number;
	electiveExcess: number;
}

export function getPlanSummary(years: readonly PlanYear[]): PlanSummary {
	const categories = getCategoryCredits(years);
	const totalCredits =
		categories.COMPULSORY + categories.PROF_ORIENTED + categories.ELECTIVE;

	return {
		totalCredits,
		remainingCredits: Math.max(0, BACHELOR_TOTAL_CREDITS - totalCredits),
		excessCredits: Math.max(0, totalCredits - BACHELOR_TOTAL_CREDITS),
		categories,
		profOrientedMissing: Math.max(
			0,
			PROF_ORIENTED_MIN_CREDITS - categories.PROF_ORIENTED,
		),
		electiveAvailable: Math.max(0, ELECTIVE_MAX_CREDITS - categories.ELECTIVE),
		electiveExcess: Math.max(0, categories.ELECTIVE - ELECTIVE_MAX_CREDITS),
	};
}

export function isYearEditable(year: PlanYear): boolean {
	return year.status === "planned";
}

export function formatCredits(credits: number): string {
	return `${credits} кр.`;
}

export function formatHours(hours: number): string {
	return `${hours.toLocaleString("uk-UA")} год`;
}
