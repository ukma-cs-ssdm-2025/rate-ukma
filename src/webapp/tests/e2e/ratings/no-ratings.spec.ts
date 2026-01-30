import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CourseDetailsPage } from "../courses/course-details.page";
import { CoursesPage } from "../courses/courses.page";

/**
 * NOTE: These tests rely on finding a course with no ratings.
 * The test navigates to the last course on the last page, assuming it has no ratings.
 * If test data changes (e.g., ratings are added), tests will be skipped with a clear message.
 */
test.describe("No ratings are displayed correctly", () => {
	let coursesPage: CoursesPage;
	let coursePage: CourseDetailsPage;
	let hasNoRatings: boolean;

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

		hasNoRatings = (await coursePage.getReviewsCount()) === 0;
	});

	test("shows 'no reviews yet' message when course has no ratings", async () => {
		test.skip(
			!hasNoRatings,
			"Skipped: The last course on the last page has ratings. Test requires a course with no ratings.",
		);

		expect(await coursePage.getReviewsCount()).toBe(0);
		await coursePage.expectNoReviewsMessageVisible();
	});

	test("shows aggregated stats are not meaningful when course has no ratings", async () => {
		test.skip(
			!hasNoRatings,
			"Skipped: The last course on the last page has ratings. Test requires a course with no ratings.",
		);

		expect(await coursePage.getReviewsCount()).toBe(0);
		expect(await coursePage.hasStatsData()).toBe(false);
	});
});
