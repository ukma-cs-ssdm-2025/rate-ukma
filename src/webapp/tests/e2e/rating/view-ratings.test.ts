import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const WITH_RATINGS_COURSE_ID =
	process.env.WITH_RATINGS_COURSE_ID ?? "5c52f0bc-d409-42a0-a1d7-10f80c6c0b7d";
const WITH_RATINGS_COURSE_DETAILS_PAGE = `${BASE_URL}/courses/${WITH_RATINGS_COURSE_ID}`;

test.describe("Course Ratings Display", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(WITH_RATINGS_COURSE_DETAILS_PAGE);
		await page.waitForLoadState("domcontentloaded");
	});

	test("course details page loads successfully", async ({ page }) => {
		await expect(page.locator("h1")).toBeVisible();
	});

	test("displays average ratings when course has ratings", async ({ page }) => {
		const statsCards = page.locator("[class*='grid gap-4 sm:grid-cols-3']");

		await expect(
			statsCards.locator("p").filter({ hasText: "Складність" }),
		).toBeVisible();
		await expect(
			statsCards.locator("p").filter({ hasText: "Корисність" }),
		).toBeVisible();
		await expect(
			statsCards.locator("p").filter({ hasText: "Відгуків" }),
		).toBeVisible();

		// numeric values are displayed (not "—" which indicates no data)
		const difficultyValue = statsCards
			.locator("span")
			.filter({ hasText: /\d+\.\d+/ })
			.first();
		const usefulnessValue = statsCards
			.locator("span")
			.filter({ hasText: /\d+\.\d+/ })
			.nth(1);

		await expect(difficultyValue).toBeVisible();
		await expect(usefulnessValue).toBeVisible();
	});

	test("displays ratings count when course has ratings", async ({ page }) => {
		const statsCards = page.locator("[class*='grid gap-4 sm:grid-cols-3']");
		const reviewsCard = statsCards
			.locator("div")
			.filter({ hasText: "Відгуків" });

		const countElement = reviewsCard.locator("span").filter({ hasText: /\d+/ });
		await expect(countElement).toBeVisible();

		// (відгук/відгуки/відгуків)
		const hintElement = reviewsCard
			.locator("span")
			.filter({ hasText: /відгук/ });
		await expect(hintElement).toBeVisible();
	});

	test("displays individual reviews list when course has reviews", async ({
		page,
	}) => {
		await expect(
			page.locator("h2").filter({ hasText: "Відгуки студентів" }),
		).toBeVisible();

		const reviewCards = page
			.locator("article")
			.filter({ hasText: /Складність:|Корисність:/ });
		await expect(reviewCards.first()).toBeVisible();

		const firstReview = reviewCards.first();
		await expect(
			firstReview.locator("span").filter({ hasText: "Складність:" }),
		).toBeVisible();
		await expect(
			firstReview.locator("span").filter({ hasText: "Корисність:" }),
		).toBeVisible();
	});
});
