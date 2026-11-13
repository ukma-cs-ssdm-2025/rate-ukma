import { expect, test, type Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";

const toggle = testIds.header.themeToggle;

function renderedScheme(page: Page) {
	return page.evaluate(() => ({
		background: getComputedStyle(document.body).backgroundColor,
		colorScheme: getComputedStyle(document.documentElement).colorScheme,
	}));
}

async function pickTheme(page: Page, value: "light" | "dark" | "system") {
	await page.getByTestId(toggle).click();
	await page.getByTestId(`${toggle}-option-${value}`).click();
}

test.describe("Theme", () => {
	test("System follows the OS live and an explicit pick wins", async ({
		page,
	}) => {
		const html = page.locator("html");
		await page.emulateMedia({ colorScheme: "light" });
		await page.goto("/");
		await expect(page.getByTestId(toggle)).toBeVisible();

		await expect(html).not.toHaveAttribute("data-color-scheme");
		const light = await renderedScheme(page);
		expect(light.colorScheme).toBe("light");

		await page.emulateMedia({ colorScheme: "dark" });
		const dark = await renderedScheme(page);
		expect(dark.colorScheme).toBe("dark");
		expect(dark.background).not.toBe(light.background);

		await pickTheme(page, "light");
		await expect(html).toHaveAttribute("data-color-scheme", "light");
		expect(await renderedScheme(page)).toEqual(light);

		await page.reload();
		await expect(page.getByTestId(toggle)).toBeVisible();
		expect(await renderedScheme(page)).toEqual(light);

		await pickTheme(page, "system");
		await expect(html).not.toHaveAttribute("data-color-scheme");
		expect(await renderedScheme(page)).toEqual(dark);
	});
});
