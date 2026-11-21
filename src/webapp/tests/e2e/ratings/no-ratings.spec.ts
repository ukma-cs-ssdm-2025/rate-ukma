import { testIds } from "@/lib/test-ids";
import { expect, test } from "../framework/fixtures";

test.describe("No ratings are displayed correctly", () => {
	test.beforeEach(async ({ page, coursePage, courseWithoutRatings }) => {
		await coursePage.goto(courseWithoutRatings.id);

		await expect(page.getByTestId(testIds.courseDetails.title)).toBeVisible();
		await expect(
			page.getByTestId(testIds.courseDetails.reviewsSection),
		).toBeVisible();
		await expect(
			page.getByTestId(testIds.courseDetails.ratingsCountStat),
		).toBeVisible();
	});

	test("shows 'no reviews yet' message when course has no ratings", async ({
		coursePage,
	}) => {
		expect(await coursePage.getReviewsCount()).toBe(0);
		await coursePage.expectNoReviewsMessageVisible();
	});

	test("shows aggregated stats are not meaningful when course has no ratings", async ({
		coursePage,
	}) => {
		expect(await coursePage.getReviewsCount()).toBe(0);
		expect(await coursePage.hasStatsData()).toBe(false);
	});
});
