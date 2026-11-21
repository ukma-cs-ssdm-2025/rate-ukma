export const TEST_QUERIES = {
	common: "програм",
	math: "математ",
	object: "об`єкт",
	nonExistent: "XYZ_TestCourse_DoesNotExist_99999_QWERTY",
} as const;

export const TEST_RANGES = {
	lowDifficulty: [1, 1.5] as [number, number],
	highDifficulty: [4, 5] as [number, number],
	moderateDifficulty: [2, 4] as [number, number],

	highUsefulness: [4, 5] as [number, number],
	veryHighUsefulness: [4.8, 5] as [number, number],
	moderateUsefulness: [2.5, 4] as [number, number],
} as const;
