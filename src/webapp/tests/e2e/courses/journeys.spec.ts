import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CoursesPage } from "./courses.page";
import { TEST_QUERIES } from "./fixtures/courses";
import { getSearchParam } from "../shared/url-assertions";

test.describe("Courses integration", () => {
	test("search → filter → sort → paginate → reset", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		await test.step("search", async () => {
			await coursesPage.searchByTitle(TEST_QUERIES.common);
			expect(getSearchParam(page, "q")).toBe(TEST_QUERIES.common);
		});

		await test.step("filter difficulty", async () => {
			const panel = page.getByTestId(testIds.filters.panel);
			await expect(panel).toBeVisible();

			const slider = panel.getByTestId(testIds.filters.difficultySlider);
			await slider.scrollIntoViewIfNeeded();

			const box = await slider.boundingBox();
			if (!box) {
				throw new Error("Could not get difficulty slider bounding box");
			}

			await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
			await expect.poll(() => getSearchParam(page, "diff")).not.toBe("");
		});

		await test.step("sort by usefulness", async () => {
			await coursesPage.sortByUsefulness();
			await expect.poll(() => getSearchParam(page, "useOrder")).toBe("desc");
		});

		await test.step("paginate", async () => {
			const nextButton = page.getByTestId(testIds.common.paginationNext);
			if (await nextButton.isDisabled()) {
				return;
			}

			await coursesPage.goToNextPage();
			expect(getSearchParam(page, "page")).toBe("2");
		});

		await test.step("verify URL state", async () => {
			expect(getSearchParam(page, "q")).toBe(TEST_QUERIES.common);
			expect(getSearchParam(page, "diff")).not.toBe("");
			expect(getSearchParam(page, "useOrder")).toBe("desc");
		});

		await test.step("reset", async () => {
			await coursesPage.resetFilters();

			expect(getSearchParam(page, "q")).toBe("");
			expect(getSearchParam(page, "diff")).toBe("");
			expect(getSearchParam(page, "useOrder")).toBe("");
			expect(getSearchParam(page, "diffOrder")).toBe("");
			expect(getSearchParam(page, "page")).toBe("");
		});
	});
});
