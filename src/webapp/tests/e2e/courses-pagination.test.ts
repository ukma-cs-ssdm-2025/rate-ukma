import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CoursesPage } from "./components";

test.describe("Courses pagination", () => {
	test("navigates to next and previous pages", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const nextButton = page.getByTestId(testIds.common.paginationNext);
		if (await nextButton.isDisabled()) {
			test.skip(true, "Pagination is not available (single page of results)");
		}

		const beforeLabel = await coursesPage.getPaginationLabelText();

		await coursesPage.goToNextPage();
		const afterLabel = await coursesPage.getPaginationLabelText();
		expect(afterLabel).not.toBe(beforeLabel);
		expect(new URL(page.url()).searchParams.get("page")).toBe("2");

		await coursesPage.goToPreviousPage();
		const finalLabel = await coursesPage.getPaginationLabelText();
		expect(finalLabel).toBe(beforeLabel);
		expect(new URL(page.url()).searchParams.get("page") ?? "1").toBe("1");
	});
});
