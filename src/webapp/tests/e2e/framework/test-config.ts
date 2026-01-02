export interface TestRatingData {
	difficulty: number;
	usefulness: number;
	comment: string;
}

const DEFAULT_TEST_RATING: TestRatingData = {
	difficulty: 3,
	usefulness: 4,
	comment: "Test comment for e2e testing",
};

export function createTestRatingData(
	overrides?: Partial<TestRatingData>,
): TestRatingData {
	return { ...DEFAULT_TEST_RATING, ...overrides };
}
