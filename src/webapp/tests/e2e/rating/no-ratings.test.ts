import { expect, test } from "@playwright/test";

import { CourseDetailsPage } from "../components/course-details-page";

test.describe("No ratings are displayed correctly", () => {
	//! TBD
	// This test suite will be rewritten after ratings count filter sorting is implemented

	let coursePage: CourseDetailsPage;

	test.beforeEach(async ({ page }) => {
		coursePage = new CourseDetailsPage(page);
	});

	test.skip("shows 'no reviews yet' message when course has no ratings", async () => {
		expect(await coursePage.isNoReviewsMessageVisible()).toBe(true);
	});

	test.skip("shows 'insufficient data' for stats when course has no ratings", async () => {
		expect(await coursePage.hasStatsData()).toBe(false);

		const insufficientDataCount =
			await coursePage.getInsufficientDataMessagesCount();
		expect(insufficientDataCount).toBe(3);
	});
});
