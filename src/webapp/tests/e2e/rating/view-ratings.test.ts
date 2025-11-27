import { expect, test } from "@playwright/test";

import { navigateToCoursePage, waitForPageReady } from "../components";
import { CourseDetailsPage } from "../components/course-details-page";
import { TEST_CONFIG } from "../components/test-config";

test.describe("Ratings are displayed", () => {
	let coursePage: CourseDetailsPage;

	test.beforeEach(async ({ page }) => {
		coursePage = new CourseDetailsPage(page);

		await navigateToCoursePage(page, TEST_CONFIG.courses.withRatings);
		await waitForPageReady(page);
	});

	test("course details page loads successfully", async () => {
		expect(await coursePage.isPageLoaded()).toBe(true);
	});

	test("displays average ratings when course has ratings", async () => {
		expect(await coursePage.hasStatsData()).toBe(true);
	});

	test("displays ratings count when course has ratings", async () => {
		const reviewsCount = await coursePage.getReviewsCount();
		expect(reviewsCount).toBeGreaterThan(0);

		const reviewsCard = coursePage["reviewsCountStat"];
		await expect(reviewsCard).toBeVisible();
	});

	test("displays individual reviews list when course has reviews", async () => {
		expect(await coursePage.isReviewsSectionVisible()).toBe(true);

		const reviewCount = await coursePage.getReviewCardsCount();
		expect(reviewCount).toBeGreaterThan(0);
	});
});
