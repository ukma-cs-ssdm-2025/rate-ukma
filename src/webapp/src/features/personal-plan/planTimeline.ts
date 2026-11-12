import { getAcademicStartYear } from "@/features/courses/courseFormatting";
import { PLAN_LIMITS } from "./planRules";
import type {
	PlanSemesterCourses,
	PlanTarget,
	PlanTerm,
	PlanYear,
	PlanYearStatus,
} from "./planTypes";
import { PLAN_TERMS } from "./planTypes";

/** Taken or planned courses keyed by `semesterKey`. */
export type SemesterCoursesByKey = Readonly<
	Record<string, PlanSemesterCourses | undefined>
>;

const SEPTEMBER = 8;

export function currentAcademicYearStart(now: Date): number {
	return now.getMonth() >= SEPTEMBER
		? now.getFullYear()
		: now.getFullYear() - 1;
}

export function semesterKey({ studyYear, term }: PlanTarget): string {
	return `${studyYear}-${term}`;
}

export function isPlanTerm(value: string | undefined): value is PlanTerm {
	return PLAN_TERMS.includes(value as PlanTerm);
}

/** Study year (1-based) of a calendar semester, counted from enrolment. */
export function studyYearOf(
	enrollmentYearStart: number,
	year: number,
	term: PlanTerm,
): number {
	return (getAcademicStartYear(year, term) ?? year) - enrollmentYearStart + 1;
}

function yearStatus(
	academicYearStart: number,
	currentYearStart: number,
): PlanYearStatus {
	if (academicYearStart < currentYearStart) return "done";
	if (academicYearStart === currentYearStart) return "current";
	return "planned";
}

const EMPTY: PlanSemesterCourses = { main: [], backup: [] };

interface BuildPlanYearsInput {
	enrollmentYearStart: number;
	currentYearStart: number;
	/** What САЗ says the student took; all there is for past years. */
	taken: SemesterCoursesByKey;
	/** The student's own picks, for the current and later years. */
	planned: SemesterCoursesByKey;
}

/** САЗ courses first, then the student's picks that САЗ does not list yet. */
function mergeSemester(
	taken: PlanSemesterCourses | undefined,
	planned: PlanSemesterCourses | undefined,
): PlanSemesterCourses {
	const takenIds = new Set(taken?.main.map((course) => course.courseId));
	const notTaken = (courses: PlanSemesterCourses["main"] = []) =>
		courses.filter((course) => !takenIds.has(course.courseId));
	return {
		main: [...(taken?.main ?? []), ...notTaken(planned?.main)],
		backup: notTaken(planned?.backup),
	};
}

function semesterCourses(
	status: PlanYearStatus,
	taken: PlanSemesterCourses | undefined,
	planned: PlanSemesterCourses | undefined,
): PlanSemesterCourses {
	if (status === "done") return taken ?? EMPTY;
	if (status === "planned") return planned ?? EMPTY;
	// The current year mixes what has started with what is still to pick.
	return mergeSemester(taken, planned);
}

export function buildPlanYears({
	enrollmentYearStart,
	currentYearStart,
	taken,
	planned,
}: BuildPlanYearsInput): PlanYear[] {
	const takenYears = Object.keys(taken).map((key) => Number.parseInt(key, 10));
	const yearCount = Math.max(PLAN_LIMITS.studyYears, ...takenYears);

	return Array.from({ length: yearCount }, (_, index) => {
		const studyYear = index + 1;
		const academicYearStart = enrollmentYearStart + index;
		const status = yearStatus(academicYearStart, currentYearStart);
		return {
			studyYear,
			academicYearStart,
			status,
			semesters: PLAN_TERMS.map((term) => {
				const key = semesterKey({ studyYear, term });
				return {
					term,
					...semesterCourses(status, taken[key], planned[key]),
					unavailable: term === "SUMMER" && studyYear === yearCount,
				};
			}),
		};
	});
}

export function allCourseIds(years: readonly PlanYear[]): Set<string> {
	return new Set(
		years.flatMap((year) =>
			year.semesters.flatMap((semester) =>
				[...semester.main, ...semester.backup].map((course) => course.courseId),
			),
		),
	);
}
