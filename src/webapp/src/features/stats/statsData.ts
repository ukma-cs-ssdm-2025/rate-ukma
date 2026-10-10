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
	/** Current students whose speciality belongs to this faculty. */
	currentStudents: number;
	currentWithAccount: number;
	currentWhoRated: number;
}

export interface PlatformStats {
	ratings: number;
	ratedCourses: number;
	/** Students enrolled in 2025–26 or later, i.e. not graduates. */
	currentStudents: number;
	currentWithAccount: number;
	currentWhoRated: number;
	studentsWhoRated: number;
	withComment: number;
	anonymous: number;
	/** Upvotes and downvotes on reviews. */
	votes: number;
	upvotes: number;
	/** Average scores of anonymous vs signed ratings. */
	byAnonymity: { group: string; difficulty: number; usefulness: number }[];
	/** Years between the course and its rating. */
	lag: { years: number; ratings: number }[];
	/** Score counts 1..5 split by whether the rating was anonymous. */
	scoresByAnonymity: Record<
		"anonymous" | "named",
		{ difficulty: number[]; usefulness: number[] }
	>;
	ratingsPerStudent: { n: number; students: number }[];
	ratingsPerCourse: { n: number; courses: number }[];
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
	currentStudents: 5741,
	currentWithAccount: 1191,
	currentWhoRated: 219,
	studentsWhoRated: 221,
	withComment: 850,
	anonymous: 1099,
	votes: 548,
	upvotes: 496,
	byAnonymity: [
		{ group: "Анонімно", difficulty: 2.82, usefulness: 3.06 },
		{ group: "З іменем", difficulty: 2.8, usefulness: 3.49 },
	],
	lag: [
		{ years: 0, ratings: 57 },
		{ years: 1, ratings: 967 },
		{ years: 2, ratings: 542 },
		{ years: 3, ratings: 164 },
		{ years: 4, ratings: 52 },
		{ years: 5, ratings: 11 },
	],
	scoresByAnonymity: {
		anonymous: {
			difficulty: [166, 319, 272, 227, 115],
			usefulness: [161, 270, 239, 196, 233],
		},
		named: {
			difficulty: [104, 193, 198, 134, 65],
			usefulness: [67, 104, 154, 159, 210],
		},
	},
	ratingsPerStudent: [
		{ n: 1, students: 65 },
		{ n: 2, students: 26 },
		{ n: 3, students: 16 },
		{ n: 4, students: 12 },
		{ n: 5, students: 9 },
		{ n: 6, students: 9 },
		{ n: 7, students: 10 },
		{ n: 8, students: 7 },
		{ n: 9, students: 3 },
		{ n: 10, students: 11 },
		{ n: 11, students: 8 },
		{ n: 12, students: 3 },
		{ n: 13, students: 2 },
		{ n: 14, students: 1 },
		{ n: 15, students: 6 },
		{ n: 17, students: 1 },
		{ n: 18, students: 2 },
		{ n: 19, students: 1 },
		{ n: 21, students: 1 },
		{ n: 22, students: 5 },
		{ n: 23, students: 2 },
		{ n: 24, students: 2 },
		{ n: 25, students: 2 },
		{ n: 29, students: 1 },
		{ n: 30, students: 3 },
		{ n: 31, students: 2 },
		{ n: 32, students: 2 },
		{ n: 33, students: 1 },
		{ n: 35, students: 1 },
		{ n: 37, students: 1 },
		{ n: 39, students: 1 },
		{ n: 43, students: 2 },
		{ n: 45, students: 2 },
		{ n: 52, students: 1 },
	],
	ratingsPerCourse: [
		{ n: 1, courses: 250 },
		{ n: 2, courses: 115 },
		{ n: 3, courses: 62 },
		{ n: 4, courses: 30 },
		{ n: 5, courses: 27 },
		{ n: 6, courses: 16 },
		{ n: 7, courses: 11 },
		{ n: 8, courses: 7 },
		{ n: 9, courses: 6 },
		{ n: 10, courses: 5 },
		{ n: 11, courses: 7 },
		{ n: 12, courses: 6 },
		{ n: 14, courses: 2 },
		{ n: 15, courses: 3 },
		{ n: 16, courses: 2 },
		{ n: 19, courses: 3 },
		{ n: 23, courses: 1 },
		{ n: 24, courses: 1 },
		{ n: 25, courses: 1 },
		{ n: 28, courses: 2 },
		{ n: 36, courses: 1 },
		{ n: 64, courses: 1 },
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
			currentStudents: 824,
			currentWithAccount: 422,
			currentWhoRated: 105,
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
			currentStudents: 1055,
			currentWithAccount: 171,
			currentWhoRated: 24,
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
			currentStudents: 1125,
			currentWithAccount: 193,
			currentWhoRated: 40,
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
			currentStudents: 1131,
			currentWithAccount: 238,
			currentWhoRated: 31,
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
			currentStudents: 480,
			currentWithAccount: 79,
			currentWhoRated: 4,
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
			currentStudents: 264,
			currentWithAccount: 30,
			currentWhoRated: 6,
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
			currentStudents: 690,
			currentWithAccount: 49,
			currentWhoRated: 8,
		},
	],
};
