import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CoursesPage } from "./components";

test.describe("Courses filters", () => {
	test("reset clears active filters (search query)", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const query = "Методи розробки програмних систем";
		await coursesPage.searchByTitle(query);

		await expect(page.getByTestId(testIds.filters.resetButton)).toBeVisible();
		await coursesPage.resetFilters();

		await expect(page.getByTestId(testIds.courses.searchInput)).toHaveValue("");
		expect(new URL(page.url()).searchParams.get("q") ?? "").toBe("");
	});

	test.describe("mobile drawer", () => {
		test.use({ viewport: { width: 390, height: 844 } });

		test("opens and closes filters drawer", async ({ page }) => {
			const coursesPage = new CoursesPage(page);
			await coursesPage.goto();

			await coursesPage.openFiltersDrawer();
			await expect(page.getByTestId(testIds.filters.drawer)).toBeVisible();

			await coursesPage.closeFiltersDrawer();
			await expect(page.getByTestId(testIds.filters.drawer)).toBeHidden();
		});
	});
});
