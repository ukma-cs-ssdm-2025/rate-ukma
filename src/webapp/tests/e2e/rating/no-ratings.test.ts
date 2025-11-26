import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const NO_RATINGS_COURSE_ID =
	process.env.NO_RATINGS_COURSE_ID ?? "5c52f0bc-d409-42a0-a1d7-10f80c6c0b7d";
const NO_RATINGS_COURSE_DETAILS_PAGE = `${BASE_URL}/courses/${NO_RATINGS_COURSE_ID}`;

test.describe("Course Ratings Display", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(NO_RATINGS_COURSE_DETAILS_PAGE);
		await page.waitForLoadState("domcontentloaded");
	});

	test("shows 'no reviews yet' message when course has no ratings", async ({
		page,
	}) => {
		const noReviewsMessage = page.locator("p").filter({
			hasText: "Поки що немає відгуків для цього курсу",
		});

		await noReviewsMessage.isVisible();
	});

	test("shows 'insufficient data' for stats when course has no ratings", async ({
		page,
	}) => {
		const statsCards = page.locator("[class*='grid gap-4 sm:grid-cols-3']");

		const insufficientDataMessages = statsCards.locator("span").filter({
			hasText: /Недостатньо даних/,
		});
		await expect(insufficientDataMessages).toHaveCount(3);
	});
});
