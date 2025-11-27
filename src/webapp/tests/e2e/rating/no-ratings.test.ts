import { expect, test } from "@playwright/test";

import { navigateToCoursePage, waitForPageReady } from "../components";
import { CourseDetailsPage } from "../components/course-details-page";
import { TEST_CONFIG } from "../components/test-config";

test.describe("No ratings are displayed correctly", () => {
	let coursePage: CourseDetailsPage;

	test.beforeEach(async ({ page }) => {
		coursePage = new CourseDetailsPage(page);

		await navigateToCoursePage(page, TEST_CONFIG.courses.noRatings);
		await waitForPageReady(page);
	});

	test("shows 'no reviews yet' message when course has no ratings", async () => {
		expect(await coursePage.isNoReviewsMessageVisible()).toBe(true);
	});

	test("shows 'insufficient data' for stats when course has no ratings", async () => {
		expect(await coursePage.hasStatsData()).toBe(false);

		const insufficientDataCount =
			await coursePage.getInsufficientDataMessagesCount();
		expect(insufficientDataCount).toBe(3);
	});
});
