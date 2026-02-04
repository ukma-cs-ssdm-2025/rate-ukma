import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { getPathname, getSearchParam } from "./shared/url-assertions";

test.describe("Logout", () => {
	test("user can logout and loses access to protected routes @smoke", async ({
		page,
	}) => {
		await page.goto("/");
		await expect(page.getByTestId(testIds.courses.table)).toBeVisible();

		await page.getByTestId(testIds.header.userMenuTrigger).click();
		await expect(page.getByTestId(testIds.header.userMenu)).toBeVisible();
		await page.getByTestId(testIds.header.logoutButton).click();

		await expect(page.getByTestId(testIds.login.microsoftButton)).toBeVisible();
		expect(getPathname(page)).toBe("/login");

		await page.goto("/");
		await expect(page.getByTestId(testIds.login.microsoftButton)).toBeVisible();

		expect(getPathname(page)).toBe("/login");
		expect(getSearchParam(page, "redirect")).toBe("/");
	});
});
