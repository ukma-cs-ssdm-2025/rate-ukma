import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const COURSES_PAGE_TITLE_TEXT = "Курси";
const COURSE_PAGE_PATTERN = /.*\/courses\/[0-9a-fA-F-]+$/;

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
		const firstCourse = page
			.locator("table tbody tr")
			.first()
			.locator("td")
			.first()
			.locator("span.font-semibold");

		await expect(firstCourse).toBeVisible();

		const courseTitle = await firstCourse.textContent();
		console.log(`Clicking course: ${courseTitle}`);

		await firstCourse.click();

		await expect(page).toHaveURL(COURSE_PAGE_PATTERN);
		await expect(page.locator("h1")).toContainText(courseTitle || "");
	});
});
