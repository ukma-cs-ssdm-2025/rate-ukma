import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CoursesPage } from "./courses.page";
import { TEST_QUERIES } from "./fixtures/courses";
import { getSearchParam } from "../shared/url-assertions";

test.describe("Courses search", () => {
	test("search updates URL and stays stable @smoke", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const query = TEST_QUERIES.common;
		await coursesPage.searchByTitle(query);

		await expect(page.getByTestId(testIds.courses.searchInput)).toHaveValue(
			query,
		);
		expect(getSearchParam(page, "q")).toBe(query);

		const courseCount = await coursesPage.getCourseCount();
		if (courseCount === 0) {
			await expect(page.getByTestId(testIds.courses.emptyState)).toBeVisible();
		}
	});

	test("search with no results shows empty state", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const query = TEST_QUERIES.nonExistent;
		await coursesPage.searchByTitle(query);

		await expect.poll(async () => await coursesPage.getCourseCount()).toBe(0);

		await expect(page.getByTestId(testIds.courses.emptyState)).toBeVisible();
		await expect(page.getByTestId(testIds.courses.searchInput)).toHaveValue(
			query,
		);
		expect(getSearchParam(page, "q")).toBe(query);
	});

	test("search supports backtick apostrophe queries", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const query = TEST_QUERIES.object;
		await coursesPage.searchByTitle(query);

		await expect(page.getByTestId(testIds.courses.searchInput)).toHaveValue(
			query,
		);
		expect(getSearchParam(page, "q")).toBe(query);

		const courseCount = await coursesPage.getCourseCount();
		if (courseCount === 0) {
			await expect(page.getByTestId(testIds.courses.emptyState)).toBeVisible();
		}
	});

	test("search resets pagination to page=1", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		await page.goto("/?page=2");
		await coursesPage.waitForTableReady();
		expect(["", "2"]).toContain(getSearchParam(page, "page"));

		await coursesPage.searchByTitle(TEST_QUERIES.common);
		expect(getSearchParam(page, "page")).toBe("");
	});
});
