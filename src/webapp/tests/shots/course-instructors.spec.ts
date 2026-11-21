import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { setFeatureFlagOverride } from "../e2e/shared/feature-flags";
import { COURSES } from "./fixtures/data";
import { mockBackend } from "./fixtures/mockBackend";
import { testIds } from "../../src/lib/test-ids";

const out = resolve(process.env.SHOT_DIR ?? "shots/course-instructors");
const WIDTHS = [375, 1280] as const;

async function open(page: Page, flag: boolean, width: number) {
	await page.setViewportSize({ width, height: 900 });
	await setFeatureFlagOverride(page, "fe_course_instructors", flag);
	await page.goto(`/courses/${COURSES[0].id}`);
	await expect(page.getByTestId(testIds.courseDetails.title)).toBeVisible();
}

for (const width of WIDTHS) {
	test(`the teachers row at ${width} px`, async ({ page }) => {
		await mockBackend(page);
		await open(page, true, width);

		const row = page.getByTestId(testIds.courseDetails.teachers);
		await expect(row).toContainText("Демченко Олена Петрівна");
		await expect(row).toContainText("обрали 6 студентів");
		await expect(row).toContainText("обрали 2 студенти");
		await expect(row).not.toContainText("Коваль");

		mkdirSync(out, { recursive: true });
		await page.screenshot({
			path: resolve(out, `teachers-${width}.png`),
			animations: "disabled",
		});
	});
}

test("no row while the flag is off", async ({ page }) => {
	await mockBackend(page);
	await open(page, false, 1280);

	await expect(page.getByTestId(testIds.courseDetails.teachers)).toHaveCount(0);
});

test("no row when nobody named a teacher twice", async ({ page }) => {
	await mockBackend(page, { courseInstructors: "none" });
	await open(page, true, 1280);

	await expect(page.getByTestId(testIds.courseDetails.teachers)).toHaveCount(0);
});
