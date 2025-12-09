import { expect, test } from "@playwright/test";

import { CoursesPage } from "../components";
import { CourseDetailsPage } from "../components/course-details-page";

test.describe("Ratings are displayed", () => {
	// TBD: this test suite components will be adjusted after ratings count filter sorting is implemented

	let courseDetailsPage: CourseDetailsPage;
	let coursesPage: CoursesPage;

	test.beforeEach(async ({ page }) => {
		coursesPage = new CoursesPage(page);
		courseDetailsPage = new CourseDetailsPage(page);

		await coursesPage.goto();
		await page.waitForLoadState("networkidle");

		await coursesPage.navigateToFirstCourseDetailsPage();
		await page.waitForLoadState("networkidle");

		await courseDetailsPage.waitForPageLoad();
	});

	test("displays reviews list and stats when course has reviews", async () => {
		await courseDetailsPage.waitForReviewsData();

		expect(await courseDetailsPage.hasStatsData()).toBe(true);
		expect(await courseDetailsPage.isReviewsSectionVisible()).toBe(true);

		const reviewCountStats = await courseDetailsPage.getReviewCardsCount();
		const reviewsCount = await courseDetailsPage.getReviewsCount();

		expect(reviewCountStats).toBeGreaterThan(0);
		expect(reviewsCount).toBeGreaterThan(0);
	});
});
