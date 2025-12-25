import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CoursesPage, TEST_CONFIG } from "../components";
import {
	mockCoursesListEmpty,
	mockCoursesListError,
	restoreCoursesListApi,
} from "../fixtures/api-mocks";
import { TEST_QUERIES } from "../fixtures/courses";
import { getSearchParam } from "../helpers/url-assertions";

test.describe("Courses error states", () => {
	test("shows error state on courses API 500", async ({ page }) => {
		await mockCoursesListError(page, 500);

		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		await expect(page.getByTestId(testIds.courses.errorState)).toBeVisible();
		await expect(page.getByTestId(testIds.courses.retryButton)).toBeVisible();
	});

	test("retry recovers after a transient error", async ({ page }) => {
		await mockCoursesListError(page, 500);

		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		await expect(page.getByTestId(testIds.courses.errorState)).toBeVisible();

		await restoreCoursesListApi(page);
		await page.getByTestId(testIds.courses.retryButton).click();

		await coursesPage.waitForTableReady();
		await expect(page.getByTestId(testIds.courses.errorState)).toBeHidden();
		await expect.poll(() => coursesPage.getCourseCount()).toBeGreaterThan(0);
	});

	test("empty courses response shows empty state (not error)", async ({
		page,
	}) => {
		await mockCoursesListEmpty(page);

		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		await expect(page.getByTestId(testIds.courses.errorState)).toBeHidden();
		await expect(page.getByTestId(testIds.courses.emptyState)).toBeVisible();
		await expect.poll(() => coursesPage.getCourseCount()).toBe(0);
	});

	test("filters persist after error and retry", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		await coursesPage.searchByTitle(TEST_QUERIES.common);
		expect(getSearchParam(page, "q")).toBe(TEST_QUERIES.common);

		await mockCoursesListError(page, 500);
		await page.reload();

		await expect(page.getByTestId(testIds.courses.errorState)).toBeVisible({
			timeout: TEST_CONFIG.timeoutMs,
		});
		expect(getSearchParam(page, "q")).toBe(TEST_QUERIES.common);

		await restoreCoursesListApi(page);
		await page.getByTestId(testIds.courses.retryButton).click();
		await coursesPage.waitForTableReady();

		await expect(page.getByTestId(testIds.courses.searchInput)).toHaveValue(
			TEST_QUERIES.common,
		);
	});
});
