import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CourseDetailsPage } from "../courses/course-details.page";
import { CoursesPage } from "../courses/courses.page";

test.describe("No ratings are displayed correctly", () => {
	let coursesPage: CoursesPage;
	let coursePage: CourseDetailsPage;

	test.beforeEach(async ({ page }) => {
		coursesPage = new CoursesPage(page);
		coursePage = new CourseDetailsPage(page);

		await coursesPage.goto();
		await coursesPage.goToLastPage();
		await coursesPage.openLastCourseOnPage();

		await expect(page.getByTestId(testIds.courseDetails.title)).toBeVisible();
		await expect(
			page.getByTestId(testIds.courseDetails.statsCards),
		).toBeVisible();
		await expect(
			page.getByTestId(testIds.courseDetails.ratingsCountStat),
		).toBeVisible();
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
