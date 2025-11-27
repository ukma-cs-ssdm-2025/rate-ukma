export const TEST_CONFIG = {
	baseUrl: process.env.BASE_URL || "http://localhost:3000",

	// Test course IDs - these should be stable test data
	courses: {
		rateCourse:
			process.env.COURSE_ID_TO_RATE ?? "07c28c6a-079c-4300-898e-5e552b6c19a5",
		withRatings:
			process.env.WITH_RATINGS_COURSE_ID ??
			"5c52f0bc-d409-42a0-a1d7-10f80c6c0b7d",
		noRatings:
			process.env.NO_RATINGS_COURSE_ID ??
			"5c52f0bc-d409-42a0-a1d7-10f80c6c0b7d",
	},

	// Test data
	testComment: "Test comment for e2e testing",

	// Timeouts
	elementTimeout: 10000,
	pageLoadTimeout: 30000,
	networkIdleTimeout: 5000,

	// Retry config
	maxRetries: 3,
	retryDelay: 500,
} as const;

export interface TestRatingData {
	difficulty: number;
	usefulness: number;
	comment: string;
}

export function createTestRatingData(
	overrides?: Partial<TestRatingData>,
): TestRatingData {
	return {
		difficulty: 3,
		usefulness: 4,
		comment: TEST_CONFIG.testComment,
		...overrides,
	};
}
