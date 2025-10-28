import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const MICROSOFT_LOGIN_REDIRECT_URL = "/api/v1/auth/login/microsoft/";
const MICROSOFT_LOGIN_PAGE_PATTERN = /.*login.microsoftonline.com.*/;
const MICROSOFT_LOGIN_BUTTON_TEXT = "Увійти";
const MICROSOFT_LOGIN_TITLE_TEXT = "Вхід";
const RATE_UKMA_TITLE_PATTERN = /Rate UKMA/;

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
		await page.route(`**${MICROSOFT_LOGIN_REDIRECT_URL}**`, (route) => {
			route.request().url();
			route.fulfill({ status: 200 });
		});

		await page.goto(`${BASE_URL}/login?redirect=%2F`);
		const microsoftButton = page.locator("button", {
			hasText: MICROSOFT_LOGIN_BUTTON_TEXT,
		});
		const requestPromise = page.waitForRequest((request) =>
			request.url().includes(MICROSOFT_LOGIN_REDIRECT_URL),
		);
		await microsoftButton.click();

		const request = await requestPromise;
		expect(request.url()).toContain(MICROSOFT_LOGIN_REDIRECT_URL);
	});
});
