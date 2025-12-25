import { expect, test } from "@playwright/test";

import { CourseDetailsPage } from "../courses/course-details.page";
import { CoursesPage } from "../courses/courses.page";
import { TEST_CONFIG } from "../framework/test-config";

test.describe("No ratings are displayed correctly", () => {
	let coursesPage: CoursesPage;
	let coursePage: CourseDetailsPage;

	test.beforeEach(async ({ page }) => {
		coursesPage = new CoursesPage(page);
		coursePage = new CourseDetailsPage(page);

		await coursesPage.goto();
		await coursesPage.goToLastPage();
		await coursesPage.openLastCourseOnPage();

		await coursePage.waitForTitle(TEST_CONFIG.timeoutMs);
		await coursePage.waitForStats(TEST_CONFIG.timeoutMs);
	});

	test("shows 'no reviews yet' message when course has no ratings", async () => {
		expect(await coursePage.getReviewsCount()).toBe(0);
		expect(await coursePage.isNoReviewsMessageVisible()).toBe(true);
	});

	test("shows aggregated stats are not meaningful when course has no ratings", async () => {
		expect(await coursePage.getReviewsCount()).toBe(0);
		expect(await coursePage.hasStatsData()).toBe(false);
	});
});
