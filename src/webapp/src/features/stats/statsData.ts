// MOCKUP: live aggregates pasted by hand (2026-10-10) until a /stats endpoint serves them.

export interface FacultyStats {
	abbr: string;
	name: string;
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
	byAcademicYear: { year: number; ratings: number; courses: number }[];
	/** Index 0 is a score of 1. */
	difficulty: number[];
	usefulness: number[];
	/** Ratings written per calendar month, index 0 is January. */
	byMonth: number[];
	faculties: FacultyStats[];
}

export const PLATFORM_STATS: PlatformStats = {
	ratings: 1793,
	ratedCourses: 559,
	students: 12766,
	studentsSignedIn: 1226,
	studentsWhoRated: 221,
	withComment: 850,
	byAcademicYear: [
		{ year: 2021, ratings: 11, courses: 11 },
		{ year: 2022, ratings: 61, courses: 48 },
		{ year: 2023, ratings: 235, courses: 116 },
		{ year: 2024, ratings: 552, courses: 279 },
		{ year: 2025, ratings: 934, courses: 397 },
	],
	difficulty: [270, 512, 470, 361, 180],
	usefulness: [228, 374, 393, 355, 443],
	byMonth: [0, 1, 794, 361, 109, 95, 59, 41, 88, 9, 2, 234],
	faculties: [
		{
			abbr: "ФІ",
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
