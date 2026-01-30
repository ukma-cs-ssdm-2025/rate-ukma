import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CourseDetailsPage } from "../courses/course-details.page";
import { CoursesPage } from "../courses/courses.page";

test.describe("Ratings are displayed", () => {
	let courseDetailsPage: CourseDetailsPage;
	let coursesPage: CoursesPage;

	test.beforeEach(async ({ page }) => {
		coursesPage = new CoursesPage(page);
		courseDetailsPage = new CourseDetailsPage(page);

		await coursesPage.goto();
		await coursesPage.navigateToFirstCourseDetailsPage();
		await expect(page.getByTestId(testIds.courseDetails.title)).toBeVisible();
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
