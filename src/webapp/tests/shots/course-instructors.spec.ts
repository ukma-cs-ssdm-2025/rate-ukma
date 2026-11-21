import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
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

/** Opens the course and waits until its teachers have arrived and rendered,
 *  so an absent row means the empty result, not a request still in flight. */
async function openWithTeachers(page: Page, width: number) {
	const teachers = page.waitForResponse((response) =>
		/\/courses\/[^/]+\/instructors\/$/.test(new URL(response.url()).pathname),
	);
	await open(page, true, width);
	await teachers;
	await expect(
		page.getByTestId(testIds.courseDetails.reviewsSection),
	).toBeVisible();
}

for (const width of WIDTHS) {
	test(`the teachers row at ${width} px`, async ({ page }) => {
		await mockBackend(page);
		await open(page, true, width);

		const row = page.getByTestId(testIds.courseDetails.teachers);
		await expect(row).toContainText("Демченко Олена Петрівна");
		await expect(row).toContainText("Демчук Дмитро Олегович");
		await expect(row).not.toContainText("Коваль");
		await expect(row.getByText("обрали 5 студентів")).toHaveClass("sr-only");

		mkdirSync(out, { recursive: true });
		await page.screenshot({
			path: resolve(out, `teachers-${width}.png`),
			animations: "disabled",
		});

		await row.getByRole("button", { name: /Демченко/ }).hover();
		await expect(page.getByRole("tooltip")).toHaveText("обрали 5 студентів");
		await page.screenshot({
			path: resolve(out, `teachers-hover-${width}.png`),
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
	await openWithTeachers(page, 1280);

	await expect(page.getByTestId(testIds.courseDetails.teachers)).toHaveCount(0);
});
