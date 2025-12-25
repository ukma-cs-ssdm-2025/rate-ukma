import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000")
	.trim()
	.replace(/\/+$/, "");
const BASE_URL_PATTERN = new RegExp(`^${escapeRegExp(BASE_URL)}\\/?$`);
const MICROSOFT_LOGIN_PAGE_PATTERN = /.*login.microsoftonline.com.*/;

const MICROSOFT_LOGIN_BUTTON_TEXT = "Увійти";
const COURSE_MAP_TITLE = "Карта курсів";
const FILTERS_LABEL = "Фільтри";

const MICROSOFT_EMAIL = process.env.CORPORATE_EMAIL ?? "";
const MICROSOFT_PASSWORD = process.env.CORPORATE_PASSWORD ?? "";

test.describe("Microsoft Login Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(BASE_URL);
	});

	test("page is loaded", async ({ page }) => {
		await expect(page).toHaveURL(BASE_URL_PATTERN);
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
		await page.waitForURL(MICROSOFT_LOGIN_PAGE_PATTERN, { timeout: 30000 });
		await page.waitForSelector('input[type="email"]', { timeout: 20000 });
		await page.fill('input[type="email"]', MICROSOFT_EMAIL);
		await page.getByRole("button", { name: "Next" }).click();

		// input password
		await page.waitForSelector('input[type="password"]', { timeout: 20000 });
		await page.fill('input[type="password"]', MICROSOFT_PASSWORD);
		await page.getByRole("button", { name: "Sign in" }).click();

		// optional "Stay signed in?" prompt
		await maybeConfirmStaySignedIn(page);

		await page.waitForURL(BASE_URL_PATTERN, {
			timeout: 60000,
			waitUntil: "load",
		});
		await page.waitForLoadState("networkidle", { timeout: 30000 });

		// on the courses page - verify key elements are present
		await expect(
			page.locator("h3").filter({ hasText: COURSE_MAP_TITLE }),
		).toBeVisible({ timeout: 30000 });
		await expect(
			page.locator("h3").filter({ hasText: FILTERS_LABEL }),
		).toBeVisible({ timeout: 30000 });

		await context.storageState({ path: "playwright/.auth/microsoft.json" });
	});
});

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function maybeConfirmStaySignedIn(page: Page): Promise<void> {
	const yesButton = page.getByRole("button", { name: "Yes" });
	const noButton = page.getByRole("button", { name: "No" });

	try {
		if (await yesButton.isVisible({ timeout: 3000 })) {
			await yesButton.click();
			return;
		}
		if (await noButton.isVisible({ timeout: 1000 })) {
			await noButton.click();
		}
	} catch {
		// prompt not shown
	}
}
