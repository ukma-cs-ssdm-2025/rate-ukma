import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CoursesPage } from "./courses.page";
import { getSearchParam } from "../shared/url-assertions";

test.describe("Courses pagination", () => {
	test("navigates to next and previous pages", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const nextButton = page.getByTestId(testIds.common.paginationNext);
		if (await nextButton.isDisabled()) {
			await expect(
				page.getByTestId(testIds.common.paginationPrevious),
			).toBeDisabled();
			expect(getSearchParam(page, "page")).toBe("");

			const label = await coursesPage.getPaginationLabelText();
			expect(label).toMatch(/^Сторінка\s+1\s+з\s+1$/);
			return;
		}

		const beforeLabel = await coursesPage.getPaginationLabelText();

		await coursesPage.goToNextPage();
		const afterLabel = await coursesPage.getPaginationLabelText();
		expect(afterLabel).not.toBe(beforeLabel);
		expect(getSearchParam(page, "page")).toBe("2");

		await coursesPage.goToPreviousPage();
		const finalLabel = await coursesPage.getPaginationLabelText();
		expect(finalLabel).toBe(beforeLabel);
		expect(getSearchParam(page, "page")).toBe("");
	});

	test("previous button is disabled on first page", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		await expect(
			page.getByTestId(testIds.common.paginationPrevious),
		).toBeDisabled();
	});

	test("next button is disabled on last page", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const nextButton = page.getByTestId(testIds.common.paginationNext);
		if (await nextButton.isDisabled()) {
			const label = await coursesPage.getPaginationLabelText();
			expect(label).toMatch(/^Сторінка\s+1\s+з\s+1$/);
			return;
		}

		await coursesPage.goToLastPage();
		await expect(nextButton).toBeDisabled();
	});

	test("direct URL navigation to page=2 works", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		await page.goto("/?page=2");
		await coursesPage.waitForTableReady();

		const pageParam = getSearchParam(page, "page");
		expect(["", "2"]).toContain(pageParam);
	});

	test("pagination label has expected format @smoke", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const label = await coursesPage.getPaginationLabelText();
		expect(label).toMatch(/^Сторінка\s+\d+\s+з\s+\d+$/);
	});
});
