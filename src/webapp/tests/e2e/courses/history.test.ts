import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CoursesPage } from "../components";
import { TEST_QUERIES } from "../fixtures/courses";
import { getSearchParam } from "../helpers/url-assertions";

test.describe("Courses navigation", () => {
	test("browser back preserves courses filters", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		await coursesPage.searchByTitle(TEST_QUERIES.common);
		const coursesUrl = page.url();

		await coursesPage.clickFirstCourseCard();
		expect(page.url()).toMatch(/\/courses\/[0-9a-fA-F-]{36}$/);

		await page.goBack();
		await coursesPage.waitForTableReady();

		expect(page.url()).toBe(coursesUrl);
		await expect(page.getByTestId(testIds.courses.searchInput)).toHaveValue(
			TEST_QUERIES.common,
		);
	});

	test("browser forward restores state", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const urlInitial = page.url();

		await coursesPage.searchByTitle(TEST_QUERIES.common);
		const urlSearch = page.url();
		expect(getSearchParam(page, "q")).toBe(TEST_QUERIES.common);

		const nextButton = page.getByTestId(testIds.common.paginationNext);
		if (await nextButton.isDisabled()) {
			test.skip(true, "Pagination is not available (single page of results)");
		}

		await coursesPage.goToNextPage();
		const urlPage2 = page.url();
		expect(getSearchParam(page, "page")).toBe("2");

		await page.goBack();
		await coursesPage.waitForTableReady();
		expect(page.url()).toBe(urlSearch);

		await page.goBack();
		await coursesPage.waitForTableReady();
		expect(page.url()).toBe(urlInitial);

		await page.goForward();
		await coursesPage.waitForTableReady();
		expect(page.url()).toBe(urlSearch);
		await expect(page.getByTestId(testIds.courses.searchInput)).toHaveValue(
			TEST_QUERIES.common,
		);

		await page.goForward();
		await coursesPage.waitForTableReady();
		expect(page.url()).toBe(urlPage2);
		expect(getSearchParam(page, "page")).toBe("2");
	});
});
