export const TEST_QUERIES = {
	// Use partial queries to avoid relying on a specific course name.
	common: "програм",
	math: "математ",
	// NOTE: app text uses backtick apostrophe.
	object: "об`єкт",
	// Guaranteed to return 0 results.
	nonExistent: "XYZ_TestCourse_DoesNotExist_99999_QWERTY",
} as const;

export const TEST_ACADEMIC_YEARS = {
	// Some environments may use an en-dash; others a hyphen.
	oldYearCandidates: ["2018–2019", "2018-2019"],
} as const;

export const TEST_RANGES = {
	// Difficulty/usefulness are in [1, 5].
	lowDifficulty: [1, 1.5],
	highDifficulty: [4, 5],
	moderateDifficulty: [2, 4],

	highUsefulness: [4, 5],
	veryHighUsefulness: [4.8, 5],
	moderateUsefulness: [2.5, 4],
} as const;

export const TEST_COMBINATIONS = {
	// Intentionally unlikely: old year + very easy + extremely useful.
	expectedEmpty: {
		yearCandidates: TEST_ACADEMIC_YEARS.oldYearCandidates,
		difficulty: TEST_RANGES.lowDifficulty,
		usefulness: TEST_RANGES.veryHighUsefulness,
	},
} as const;
