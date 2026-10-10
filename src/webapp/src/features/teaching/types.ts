/**
 * Shape of the planned `GET /api/v1/teachers/me/courses/` response. The
 * endpoint does not exist yet: the prototype behind `fe_teacher_reports` reads
 * it from the screenshot mocks only, so these types live here until the
 * backend lands and orval generates them.
 */

/** Counts of 1..5 scores, index 0 holds the 1s. */
export type ScoreCounts = readonly [number, number, number, number, number];

export interface TeachingComment {
	readonly id: string;
	readonly text: string;
	readonly difficulty: number;
	readonly usefulness: number;
	readonly created_at: string;
}

export interface TeachingOffering {
	readonly id: string;
	readonly year: number;
	readonly term: string;
	/** Students enrolled in this offering. */
	readonly enrolled: number;
	/** Students who rated it. */
	readonly rated: number;
	readonly avg_difficulty: number | null;
	readonly avg_usefulness: number | null;
	readonly difficulty_counts: ScoreCounts;
	readonly usefulness_counts: ScoreCounts;
	readonly comments: readonly TeachingComment[];
}

export interface TeachingCourse {
	readonly id: string;
	readonly title: string;
	/** Newest first. */
	readonly offerings: readonly TeachingOffering[];
}

export interface TeachingCourseList {
	readonly items: readonly TeachingCourse[];
}

/** Scores stay hidden until this many students rated, so nobody is singled out. */
export const MIN_RATED_TO_SHOW = 5;
