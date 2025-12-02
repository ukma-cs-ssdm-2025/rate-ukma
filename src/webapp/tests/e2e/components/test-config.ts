export const TEST_CONFIG = {
	baseUrl: process.env.BASE_URL || "http://localhost:3000",

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
