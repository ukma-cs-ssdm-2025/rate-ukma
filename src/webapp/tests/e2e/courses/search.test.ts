import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CoursesPage } from "../components";
import { TEST_QUERIES } from "../fixtures/courses";
import { getSearchParam } from "../helpers/url-assertions";

test.describe("Courses search", () => {
	test("search updates URL and shows results", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const query = TEST_QUERIES.common;
		await coursesPage.searchByTitle(query);

		await expect
			.poll(async () => await coursesPage.getCourseCount())
			.toBeGreaterThan(0);

		await expect(page.getByTestId(testIds.courses.searchInput)).toHaveValue(
			query,
		);
		expect(getSearchParam(page, "q")).toBe(query);
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

		// Either results exist or the empty state is shown (but the UI must not crash).
		const courseCount = await coursesPage.getCourseCount();
		if (courseCount === 0) {
			await expect(page.getByTestId(testIds.courses.emptyState)).toBeVisible();
		}
	});

	test("search resets pagination to page=1", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const nextButton = page.getByTestId(testIds.common.paginationNext);
		if (await nextButton.isDisabled()) {
			test.skip(true, "Pagination is not available (single page of results)");
		}

		await coursesPage.goToNextPage();
		expect(getSearchParam(page, "page")).toBe("2");

		await coursesPage.searchByTitle(TEST_QUERIES.common);
		// page=1 is cleared from URL by default.
		expect(getSearchParam(page, "page")).toBe("");
	});
});
