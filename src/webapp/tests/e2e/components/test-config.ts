export const TEST_CONFIG = {
	baseUrl: process.env.BASE_URL || "http://localhost:3000",

	// Test course IDs - these should be stable test data
	courses: {
		rateCourse:
			process.env.COURSE_ID_TO_RATE ?? "07c28c6a-079c-4300-898e-5e552b6c19a5",
		withRatings:
			process.env.WITH_RATINGS_COURSE_ID ??
			"15f6e43a-888a-44b2-bca8-d55b1e9f43d3", // "Автоматизація роботи з програмними проектами мовою Java"
		noRatings:
			process.env.NO_RATINGS_COURSE_ID ??
			"2689bb14-ba10-4e01-9534-eb5c8d3fd116", // "C4D: Communication for Development"
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
