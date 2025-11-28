import { expect, test } from "@playwright/test";

import { CoursesPage, waitForPageReady } from "../components";
import { CourseDetailsPage } from "../components/course-details-page";

test.describe("Ratings are displayed", () => {
	// TBD: this test suite components will be adjusted after ratings count filter sorting is implemented

	let courseDetailsPage: CourseDetailsPage;
	let coursesPage: CoursesPage;

	test.beforeEach(async ({ page }) => {
		coursesPage = new CoursesPage(page);
		courseDetailsPage = new CourseDetailsPage(page);

		await coursesPage.goto();
		await coursesPage.navigateToFirstCourseDetailsPage();
		await waitForPageReady(page);
	});

	test("displays average ratings when course has ratings", async () => {
		await Promise.all([
			courseDetailsPage.waitForPageLoad(),
			courseDetailsPage.waitForElement(
				courseDetailsPage["statsCardsContainer"],
			),
		]);

		expect(await courseDetailsPage.isPageLoaded()).toBe(true);
		expect(await courseDetailsPage.hasStatsData()).toBe(true);
	});

	test("displays ratings count when course has ratings", async () => {
		await Promise.all([
			courseDetailsPage.waitForPageLoad(),
			courseDetailsPage.waitForElement(courseDetailsPage["reviewsCountStat"]),
		]);

		const reviewsCount = await courseDetailsPage.getReviewsCount();
		expect(reviewsCount).toBeGreaterThan(0);

		const reviewsCard = courseDetailsPage["reviewsCountStat"];
		await expect(reviewsCard).toBeVisible();
	});

	test("displays individual reviews list when course has reviews", async () => {
		await Promise.all([
			courseDetailsPage.waitForPageLoad(),
			courseDetailsPage.waitForElement(courseDetailsPage["reviewsSection"]),
		]);

		expect(await courseDetailsPage.isReviewsSectionVisible()).toBe(true);

		const reviewCount = await courseDetailsPage.getReviewCardsCount();
		expect(reviewCount).toBeGreaterThan(0);
	});
});
