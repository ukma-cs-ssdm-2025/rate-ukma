import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { getPathname, getSearchParam } from "./shared/url-assertions";

const MICROSOFT_LOGIN_PAGE_PATTERN = /.*login.microsoftonline.com.*/;

const CORPORATE_EMAIL = process.env.CORPORATE_EMAIL ?? "";
const CORPORATE_PASSWORD = process.env.CORPORATE_PASSWORD ?? "";

test.describe("Auth Gate", () => {
	test("unauthenticated user is redirected from / to login", async ({
		page,
	}) => {
		await page.goto("/");
		await expect(page.getByTestId(testIds.login.microsoftButton)).toBeVisible();

		expect(getPathname(page)).toBe("/login");
		expect(getSearchParam(page, "redirect")).toBe("/");
	});
});

test.describe("Microsoft Login Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/login");
		await expect(page.getByTestId(testIds.login.microsoftButton)).toBeVisible();
	});

	test("page is loaded", async ({ page }) => {
		expect(getPathname(page)).toBe("/login");
	});

	test("login with Microsoft account @smoke", async ({ page, context }) => {
		if (!CORPORATE_EMAIL || !CORPORATE_PASSWORD) {
			throw new Error("CORPORATE_EMAIL and CORPORATE_PASSWORD must be set");
		}

		await page.getByTestId(testIds.login.microsoftButton).click();

		await page.waitForURL(MICROSOFT_LOGIN_PAGE_PATTERN);
		await page.waitForSelector('input[type="email"]');
		await page.fill('input[type="email"]', CORPORATE_EMAIL);
		await page.getByRole("button", { name: "Next" }).click();

		await page.waitForSelector('input[type="password"]');
		await page.fill('input[type="password"]', CORPORATE_PASSWORD);
		await page.getByRole("button", { name: "Sign in" }).click();

		await handleStaySignedInPrompt(page);

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

async function handleStaySignedInPrompt(page: Page): Promise<void> {
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
