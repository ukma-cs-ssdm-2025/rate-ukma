// MOCKUP: live aggregates pasted by hand (2026-10-10) until a /stats endpoint serves them.

export interface FacultyStats {
	abbr: string;
	name: string;
	/** Faculty colour token from styles.css. */
	color: string;
	courses: number;
	ratedCourses: number;
	ratings: number;
	difficulty: number;
	usefulness: number;
	/** Students whose speciality belongs to this faculty. */
	students: number;
	studentsWhoRated: number;
}

export interface PlatformStats {
	ratings: number;
	ratedCourses: number;
	students: number;
	studentsSignedIn: number;
	studentsWhoRated: number;
	withComment: number;
	anonymous: number;
	/** Upvotes and downvotes on reviews. */
	votes: number;
	upvotes: number;
	/** Average scores of anonymous vs signed ratings. */
	byAnonymity: { group: string; difficulty: number; usefulness: number }[];
	/** Students who rated, bucketed by how many ratings each wrote. */
	ratersByCount: { bucket: string; students: number }[];
	/** Rated courses with at least N ratings. */
	coursesByRatings: { bucket: string; courses: number }[];
	/** Years between the course and its rating. */
	lag: { years: number; ratings: number }[];
	byAcademicYear: { year: number; ratings: number; courses: number }[];
	/** Index 0 is a score of 1. */
	difficulty: number[];
	usefulness: number[];
	/** Ratings written per calendar month, oldest first. */
	timeline: { month: string; ratings: number }[];
	faculties: FacultyStats[];
}

export const PLATFORM_STATS: PlatformStats = {
	ratings: 1793,
	ratedCourses: 559,
	students: 12766,
	studentsSignedIn: 1226,
	studentsWhoRated: 221,
	withComment: 850,
	anonymous: 1099,
	votes: 548,
	upvotes: 496,
	byAnonymity: [
		{ group: "Анонімно", difficulty: 2.82, usefulness: 3.06 },
		{ group: "З іменем", difficulty: 2.8, usefulness: 3.49 },
	],
	ratersByCount: [
		{ bucket: "1", students: 65 },
		{ bucket: "2–3", students: 42 },
		{ bucket: "4–10", students: 61 },
		{ bucket: "11+", students: 53 },
	],
	coursesByRatings: [
		{ bucket: "3+", courses: 194 },
		{ bucket: "5+", courses: 102 },
		{ bucket: "10+", courses: 35 },
		{ bucket: "20+", courses: 7 },
	],
	lag: [
		{ years: 0, ratings: 57 },
		{ years: 1, ratings: 967 },
		{ years: 2, ratings: 542 },
		{ years: 3, ratings: 164 },
		{ years: 4, ratings: 52 },
		{ years: 5, ratings: 11 },
	],
	byAcademicYear: [
		{ year: 2021, ratings: 11, courses: 11 },
		{ year: 2022, ratings: 61, courses: 48 },
		{ year: 2023, ratings: 235, courses: 116 },
		{ year: 2024, ratings: 552, courses: 279 },
		{ year: 2025, ratings: 934, courses: 397 },
	],
	difficulty: [270, 512, 470, 361, 180],
	usefulness: [228, 374, 393, 355, 443],
	timeline: [
		{ month: "2025-11", ratings: 2 },
		{ month: "2025-12", ratings: 234 },
		{ month: "2026-01", ratings: 0 },
		{ month: "2026-02", ratings: 1 },
		{ month: "2026-03", ratings: 794 },
		{ month: "2026-04", ratings: 361 },
		{ month: "2026-05", ratings: 109 },
		{ month: "2026-06", ratings: 95 },
		{ month: "2026-07", ratings: 59 },
		{ month: "2026-08", ratings: 41 },
		{ month: "2026-09", ratings: 88 },
		{ month: "2026-10", ratings: 9 },
	],
	faculties: [
		{
			abbr: "ФІ",
			color: "var(--color-faculty-purple)",
			name: "Факультет інформатики",
			courses: 660,
			ratedCourses: 172,
			ratings: 885,
			difficulty: 2.99,
			usefulness: 3.18,
			students: 1794,
			studentsWhoRated: 106,
		},
		{
			abbr: "ФГН",
			color: "var(--color-faculty-blue)",
			name: "Факультет гуманітарних наук",
			courses: 972,
			ratedCourses: 124,
			ratings: 301,
			difficulty: 2.75,
			usefulness: 3.49,
			students: 2474,
			studentsWhoRated: 24,
		},
		{
			abbr: "ФСНСТ",
			color: "var(--color-faculty-yellow)",
			name: "Факультет соціальних наук і соціальних технологій",
			courses: 1289,
			ratedCourses: 105,
			ratings: 266,
			difficulty: 2.73,
			usefulness: 3.5,
			students: 2323,
			studentsWhoRated: 40,
		},
		{
			abbr: "ФЕН",
			color: "var(--color-faculty-orange)",
			name: "Факультет економічних наук",
			courses: 443,
			ratedCourses: 70,
			ratings: 152,
			difficulty: 2.43,
			usefulness: 2.84,
			students: 2454,
			studentsWhoRated: 31,
		},
		{
			abbr: "ФОЗ",
			color: "var(--color-faculty-teal)",
			name: "Факультет охорони здоров\u2019я",
			courses: 447,
			ratedCourses: 40,
			ratings: 91,
			difficulty: 2.4,
			usefulness: 2.64,
			students: 959,
			studentsWhoRated: 4,
		},
		{
			abbr: "ФПрН",
			color: "var(--color-faculty-rose)",
			name: "Факультет правничих наук",
			courses: 482,
			ratedCourses: 19,
			ratings: 47,
			difficulty: 2.13,
			usefulness: 2.77,
			students: 775,
			studentsWhoRated: 6,
		},
		{
			abbr: "ФПвН",
			color: "var(--color-faculty-green)",
			name: "Факультет природничих наук",
			courses: 736,
			ratedCourses: 22,
			ratings: 38,
			difficulty: 3.42,
			usefulness: 3.82,
			students: 1810,
			studentsWhoRated: 9,
		},
	],
};
