import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const MICROSOFT_LOGIN_PAGE_PATTERN = /.*login.microsoftonline.com.*/;

const MICROSOFT_LOGIN_BUTTON_TEXT = "Увійти";
const COURSES_PAGE_TITLE_TEXT = "Курси";

const MICROSOFT_EMAIL = process.env.CORPORATE_EMAIL ?? "";
const MICROSOFT_PASSWORD = process.env.CORPORATE_PASSWORD ?? "";

test.describe("Microsoft Login Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(BASE_URL);
	});

	test("page is loaded", async ({ page }) => {
		await expect(page).toHaveURL(BASE_URL);
	});

	test("login with Microsoft account", async ({ page, context }) => {
		if (!MICROSOFT_EMAIL || !MICROSOFT_PASSWORD) {
			throw new Error("MICROSOFT_EMAIL and MICROSOFT_PASSWORD must be set");
		}

		const microsoftButton = page.locator("button", {
			hasText: MICROSOFT_LOGIN_BUTTON_TEXT,
		});
		await microsoftButton.click();

		// input email
		await page.waitForURL(MICROSOFT_LOGIN_PAGE_PATTERN, { timeout: 10000 });
		await page.fill('input[type="email"]', MICROSOFT_EMAIL);
		await page.getByRole("button", { name: "Next" }).click();

		// input password
		await page.waitForSelector('input[type="password"]', { timeout: 10000 });
		await page.fill('input[type="password"]', MICROSOFT_PASSWORD);
		await page.getByRole("button", { name: "Sign in" }).click();

		await page.waitForURL(BASE_URL, { timeout: 20000 });

		// on the courses page
		await expect(
			page.locator("h1").filter({ hasText: COURSES_PAGE_TITLE_TEXT }),
		).toBeVisible();

		await context.storageState({ path: "playwright/.auth/microsoft.json" });
	});
});
