import { expect, test } from "@playwright/test";

import { CoursesPage } from "./courses.page";
import { TEST_QUERIES } from "./fixtures/courses";
import { getSearchParam } from "../shared/url-assertions";

test.describe("Courses sorting", () => {
	test("difficulty sort cycles asc → desc → cleared", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		expect(getSearchParam(page, "diffOrder")).toBe("");

		await coursesPage.sortByDifficulty();
		await expect.poll(() => getSearchParam(page, "diffOrder")).toBe("asc");
		// Sorting resets pagination to page=1, which is removed from URL.
		expect(getSearchParam(page, "page")).toBe("");

		await coursesPage.sortByDifficulty();
		await expect.poll(() => getSearchParam(page, "diffOrder")).toBe("desc");

		await coursesPage.sortByDifficulty();
		await expect.poll(() => getSearchParam(page, "diffOrder")).toBe("");
	});

	test("usefulness sort starts from desc", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		expect(getSearchParam(page, "useOrder")).toBe("");

		await coursesPage.sortByUsefulness();
		await expect.poll(() => getSearchParam(page, "useOrder")).toBe("desc");

		await coursesPage.sortByUsefulness();
		await expect.poll(() => getSearchParam(page, "useOrder")).toBe("asc");
	});

	test("sorting works with search filter", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		await coursesPage.searchByTitle(TEST_QUERIES.common);
		expect(getSearchParam(page, "q")).toBe(TEST_QUERIES.common);

		await coursesPage.sortByUsefulness();

		expect(getSearchParam(page, "q")).toBe(TEST_QUERIES.common);
		expect(getSearchParam(page, "useOrder")).toBe("desc");
	});
});
