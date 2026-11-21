import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { COURSE } from "./fixtures/data";
import { mockBackend } from "./fixtures/mockBackend";
import { setFeatureFlagOverride } from "../e2e/shared/feature-flags";
import { testIds } from "../../src/lib/test-ids";

// Prototype shots for the course page side panel redesign.
const out = resolve(process.env.SHOT_DIR ?? "shots/course-panel");

for (const VARIANT of ["before", "a", "b", "c"]) {
	for (const theme of ["light", "dark"] as const) {
		for (const width of [1440, 390]) {
			test(`${VARIANT} ${theme} ${width}`, async ({ page }) => {
				await page.setViewportSize({
					width,
					height: width > 1000 ? 1000 : 844,
				});
				await page.addInitScript((value) => {
					localStorage.setItem("rate-ukma-theme", value);
				}, theme);
				await setFeatureFlagOverride(page, "fe_course_instructors", true);
				await mockBackend(page, {
					ratingSuggestions: "items",
					myCourses: "rated",
					specialities: "many",
				});
				await page.goto(`/courses/${COURSE.id}?panel=${VARIANT}`);
				await expect(
					page.getByTestId(testIds.courseDetails.title),
				).toBeVisible();
				await expect(page.getByText("Що оцінити далі")).toBeVisible();
				await page.waitForTimeout(400);
				mkdirSync(out, { recursive: true });
				const name = `${VARIANT}-${width > 1000 ? "desktop" : "phone"}-${theme}`;
				await page.screenshot({
					path: resolve(out, `${name}.png`),
					fullPage: width < 1000,
					animations: "disabled",
				});
			});
		}
	}
}

test("a expanded 1440", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.addInitScript(() =>
		localStorage.setItem("rate-ukma-theme", "light"),
	);
	await setFeatureFlagOverride(page, "fe_course_instructors", true);
	await mockBackend(page, {
		ratingSuggestions: "items",
		myCourses: "rated",
		specialities: "many",
	});
	await page.goto(`/courses/${COURSE.id}?panel=a`);
	await expect(page.getByText("Що оцінити далі")).toBeVisible();
	await page.getByRole("button", { name: "ще 2" }).click();
	await page.getByRole("button", { name: /20 потоків/ }).click();
	await page.waitForTimeout(300);
	mkdirSync(out, { recursive: true });
	await page.screenshot({ path: resolve(out, "a-desktop-light-expanded.png") });
});
