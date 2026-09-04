import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { setFeatureFlagOverride } from "../shared/feature-flags";

const FEED_FLAG = "fe_feed";

test.describe("Feed", () => {
	test("lists feed items when the flag is on", async ({ page }) => {
		await setFeatureFlagOverride(page, FEED_FLAG, true);
		await page.goto("/feed");

		await expect(
			page.getByRole("heading", { name: /Стрічка оновлень/ }),
		).toBeVisible();

		// Either the feed has content or the database is empty
		// both are valid, but the loading state must resolve into one of them
		const list = page.getByTestId(testIds.feed.list);
		const empty = page.getByTestId(testIds.feed.empty);
		await expect(list.or(empty)).toBeVisible();

		if (await list.isVisible()) {
			await expect(page.getByTestId(testIds.feed.item).first()).toBeVisible();
		}
	});

	test("stays hidden when the flag is off", async ({ page }) => {
		await setFeatureFlagOverride(page, FEED_FLAG, false);
		await page.goto("/feed");

		await expect(page.getByTestId(testIds.feed.unavailable)).toBeVisible();
		await expect(page.getByTestId(testIds.feed.list)).toHaveCount(0);
	});
});
