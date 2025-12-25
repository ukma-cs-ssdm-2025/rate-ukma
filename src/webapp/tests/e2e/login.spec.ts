import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000")
	.trim()
	.replace(/\/+$/, "");
const BASE_URL_PATTERN = new RegExp(`^${escapeRegExp(BASE_URL)}\\/?$`);
const MICROSOFT_LOGIN_PAGE_PATTERN = /.*login.microsoftonline.com.*/;

const CORPORATE_EMAIL = process.env.CORPORATE_EMAIL ?? "";
const CORPORATE_PASSWORD = process.env.CORPORATE_PASSWORD ?? "";

test.describe("Microsoft Login Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(BASE_URL);
	});

	test("page is loaded", async ({ page }) => {
		await expect(page).toHaveURL(BASE_URL_PATTERN);
	});

	test("login with Microsoft account @smoke", async ({ page, context }) => {
		if (!CORPORATE_EMAIL || !CORPORATE_PASSWORD) {
			throw new Error("CORPORATE_EMAIL and CORPORATE_PASSWORD must be set");
		}

		await page.getByTestId(testIds.login.microsoftButton).click();

		// input email
		await page.waitForURL(MICROSOFT_LOGIN_PAGE_PATTERN);
		await page.waitForSelector('input[type="email"]');
		await page.fill('input[type="email"]', CORPORATE_EMAIL);
		await page.getByRole("button", { name: "Next" }).click();

		// input password
		await page.waitForSelector('input[type="password"]');
		await page.fill('input[type="password"]', CORPORATE_PASSWORD);
		await page.getByRole("button", { name: "Sign in" }).click();

		// optional "Stay signed in?" prompt
		await maybeConfirmStaySignedIn(page);

		await page.waitForURL(BASE_URL_PATTERN, { waitUntil: "load" });

		await expect(page.getByTestId(testIds.courses.table)).toBeVisible();

		const filtersPanel = page.getByTestId(testIds.filters.panel);
		const filtersDrawerTrigger = page.getByTestId(
			testIds.filters.drawerTrigger,
		);

		let filtersUi = "";
		await expect
			.poll(async () => {
				if (await filtersPanel.isVisible()) {
					filtersUi = "desktop";
					return filtersUi;
				}
				if (await filtersDrawerTrigger.isVisible()) {
					filtersUi = "mobile";
					return filtersUi;
				}
				return "";
			})
			.not.toBe("");

		if (filtersUi === "desktop") {
			await expect(filtersPanel).toBeVisible();
		} else {
			await expect(filtersDrawerTrigger).toBeVisible();
		}

		await context.storageState({ path: "playwright/.auth/microsoft.json" });
	});
});

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function maybeConfirmStaySignedIn(page: Page): Promise<void> {
	const yesButton = page.getByRole("button", { name: "Yes" }).first();
	if (await yesButton.isVisible()) {
		await yesButton.click();
		return;
	}

	const noButton = page.getByRole("button", { name: "No" }).first();
	if (await noButton.isVisible()) {
		await noButton.click();
	}
}
