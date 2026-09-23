export type PlanCourseCategory = "COMPULSORY" | "PROF_ORIENTED" | "ELECTIVE";

export type PlanSeason = "FALL" | "SPRING" | "SUMMER";

export type PlanYearStatus = "completed" | "current" | "planned";

export interface PlanCourse {
	id: string;
	title: string;
	credits: number;
	category: PlanCourseCategory;
	facultyName?: string;
	difficulty?: number;
	usefulness?: number;
}

export interface PlanSemester {
	key: string;
	season: PlanSeason;
	courses: PlanCourse[];
	backups: PlanCourse[];
	/** Summer semester is not available on the final year of bachelor studies. */
	isUnavailable?: boolean;
}

export interface PlanYear {
	key: string;
	courseNumber: number;
	academicYear: string;
	status: PlanYearStatus;
	semesters: PlanSemester[];
}
