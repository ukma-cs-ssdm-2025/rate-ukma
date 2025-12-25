export const TEST_CONFIG = {
	baseUrl: process.env.BASE_URL || "http://localhost:3000",

	testComment: "Test comment for e2e testing",

	timeoutMs: 30_000,

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
