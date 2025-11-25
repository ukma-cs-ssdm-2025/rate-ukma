import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const COURSES_PAGE_TITLE_TEXT = "Курси";
const COURSE_PAGE_PATTERN = /\/courses\/[0-9a-fA-F-]{36}$/;

test.describe("Course Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(BASE_URL);
	});

	test("courses page is loaded", async ({ page }) => {
		await expect(
			page.locator("h1").filter({ hasText: COURSES_PAGE_TITLE_TEXT }),
		).toBeVisible();
	});

	test("courses page loads and navigates to a course details page", async ({
		page,
	}) => {
		const firstRow = page.locator("table tbody tr").first();

		const courseTitle = await firstRow
			.locator("td")
			.first()
			.locator("span.font-semibold")
			.textContent();

		console.log(`Clicking course: ${courseTitle}`);

		await Promise.all([page.waitForURL(COURSE_PAGE_PATTERN), firstRow.click()]);
		await page.waitForLoadState("domcontentloaded");

		await expect(page).toHaveURL(COURSE_PAGE_PATTERN);
		await expect(page.locator("h1")).toContainText(courseTitle || "");
	});
});
