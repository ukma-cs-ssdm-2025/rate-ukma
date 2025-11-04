import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const MICROSOFT_LOGIN_REDIRECT_URL = "/api/v1/auth/login/microsoft/";
const MICROSOFT_LOGIN_PAGE_PATTERN = /.*login.microsoftonline.com.*/;

const MICROSOFT_LOGIN_BUTTON_TEXT = "Увійти";
const MICROSOFT_LOGIN_TITLE_TEXT = "Вхід";
const COURSES_PAGE_TITLE_TEXT = "Курси";
const RATE_UKMA_TITLE_PATTERN = /Rate UKMA/;

const MICROSOFT_EMAIL = process.env.CORPORATE_EMAIL ?? "";
const MICROSOFT_PASSWORD = process.env.PASSWORD ?? "";

test.describe("Microsoft Login Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(BASE_URL);
	});

	test("page is loaded", async ({ page }) => {
		await expect(page).toHaveURL(BASE_URL);
	});

	test("displays login page with title and Microsoft login button", async ({
		page,
	}) => {
		await expect(page).toHaveTitle(RATE_UKMA_TITLE_PATTERN);
		await expect(page.locator("h1")).toContainText(MICROSOFT_LOGIN_TITLE_TEXT);

		const microsoftButton = page
			.locator("button")
			.filter({ hasText: MICROSOFT_LOGIN_BUTTON_TEXT });
		await expect(microsoftButton).toBeVisible();
	});

	test("Microsoft login button redirects to Microsoft login page", async ({
		page,
	}) => {
		const microsoftButton = page
			.locator("button")
			.filter({ hasText: MICROSOFT_LOGIN_BUTTON_TEXT });

		await microsoftButton.click();
		await expect(page).toHaveURL(MICROSOFT_LOGIN_PAGE_PATTERN);
	});

	test("Microsoft button triggers OAuth redirect request", async ({ page }) => {
		const requestPromise = page.waitForRequest((request) =>
			request.url().includes(MICROSOFT_LOGIN_REDIRECT_URL),
		);

		const microsoftButton = page.locator("button", {
			hasText: MICROSOFT_LOGIN_BUTTON_TEXT,
		});

		await microsoftButton.click();

		const request = await requestPromise;
		expect(request.url()).toContain(MICROSOFT_LOGIN_REDIRECT_URL);
	});

	test("login with Microsoft account", async ({ page }) => {
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

		try {
			await page
				.getByRole("button", { name: /Yes|No/i })
				.first()
				.click({ timeout: 5000 });
		} catch (e) {
			console.log("No stay-signed-in prompt detected");
		}

		await page.waitForURL(BASE_URL, { timeout: 20000 });

		// on the courses page
		await expect(
			page.locator("h1").filter({ hasText: COURSES_PAGE_TITLE_TEXT }),
		).toBeVisible();
	});
});
