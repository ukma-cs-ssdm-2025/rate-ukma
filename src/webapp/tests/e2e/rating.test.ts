import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const COURSE_ID_TO_RATE =
	process.env.COURSE_ID_TO_RATE ?? "07c28c6a-079c-4300-898e-5e552b6c19a5";
const NO_RATINGS_COURSE_ID =
	process.env.NO_RATINGS_COURSE_ID ?? "5c52f0bc-d409-42a0-a1d7-10f80c6c0b7d";
const COURSE_DETAILS_PAGE_TO_RATE = `${BASE_URL}/courses/${COURSE_ID_TO_RATE}`;
const NO_RATINGS_COURSE_DETAILS_PAGE = `${BASE_URL}/courses/${NO_RATINGS_COURSE_ID}`;

test.describe("Course Ratings Display", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(COURSE_DETAILS_PAGE_TO_RATE);
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

		// each review should have:
		// - student name/date
		// - difficulty and usefulness scores
		// - comment text
		const firstReview = reviewCards.first();
		await expect(
			firstReview.locator("span").filter({ hasText: "Складність:" }),
		).toBeVisible();
		await expect(
			firstReview.locator("span").filter({ hasText: "Корисність:" }),
		).toBeVisible();
	});

	test("shows 'no reviews yet' message when course has no ratings", async ({
		page,
	}) => {
		await page.goto(NO_RATINGS_COURSE_DETAILS_PAGE);
		await page.waitForLoadState("domcontentloaded");

		const noReviewsMessage = page.locator("p").filter({
			hasText: "Поки що немає відгуків для цього курсу",
		});

		await noReviewsMessage.isVisible();
	});

	test("shows 'insufficient data' for stats when course has no ratings", async ({
		page,
	}) => {
		// TODO: move to a separate test suite with a correct beforeEach()
		await page.goto(NO_RATINGS_COURSE_DETAILS_PAGE);
		await page.waitForLoadState("domcontentloaded");

		const statsCards = page.locator("[class*='grid gap-4 sm:grid-cols-3']");

		const insufficientDataMessages = statsCards.locator("span").filter({
			hasText: /Недостатньо даних/,
		});
		await expect(insufficientDataMessages).toHaveCount(3);
	});

	test("rate button appears for attended courses", async ({ page }) => {
		const rateButton = page
			.locator("button")
			.filter({ hasText: /Оцінити цей курс|Редагувати оцінку/ });

		await rateButton.isVisible();
		await rateButton.isEnabled();
	});
});

test.describe("Rating Modal Functionality", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(COURSE_DETAILS_PAGE_TO_RATE);
		await page.waitForLoadState("domcontentloaded");
		console.log(`Course details page: ${COURSE_DETAILS_PAGE_TO_RATE}`);
	});

	test("rating modal opens when rate button is clicked", async ({ page }) => {
		const rateButton = page
			.locator("button")
			.filter({ hasText: /Оцінити цей курс|Редагувати оцінку/ });

		await rateButton.isVisible();
		await rateButton.click();

		const modal = page.locator("[role='dialog']");
		await modal.isVisible();

		const modalTitle = modal.locator("h2").filter({ hasText: "Оцінити курс" });
		await expect(modalTitle).toBeVisible();
	});

	test("rating modal contains rating form elements", async ({ page }) => {
		const rateButton = page
			.locator("button")
			.filter({ hasText: /Оцінити цей курс|Редагувати оцінку/ });

		await rateButton.isVisible();
		await rateButton.click();

		const modal = page.locator("[role='dialog']");
		await modal.isVisible();

		const modalTitle = modal.locator("h2").filter({ hasText: "Оцінити курс" });
		await expect(modalTitle).toBeVisible();

		await expect(
			modal.locator("label").filter({ hasText: /Складність|Корисність/ }),
		).toHaveCount(2);

		await expect(
			modal.locator("button").filter({ hasText: /Зберегти|Надіслати/ }),
		).toBeVisible();
	});

	test("rating modal submission", async ({ page }) => {
		const rateButton = page
			.locator("button")
			.filter({ hasText: /Оцінити цей курс|Редагувати оцінку/ });

		await rateButton.isVisible();
		await rateButton.click();

		// TODO: add slider test

		const commentTextarea = page.locator("textarea[name='comment']");
		await commentTextarea.isVisible();
		await commentTextarea.fill("Test comment!");

		const saveButton = page
			.locator("button")
			.filter({ hasText: /Зберегти|Надіслати/ });
		await saveButton.isVisible();
		await saveButton.click();

		const modal = page.locator("[role='dialog']");
		await expect(modal).toBeHidden();

		const reviewCard = page
			.locator("article")
			.filter({ hasText: /Test comment!/ });
		await reviewCard.isVisible();

		// TODO: handle removing the test comment or configuring realistic test data
	});
});
