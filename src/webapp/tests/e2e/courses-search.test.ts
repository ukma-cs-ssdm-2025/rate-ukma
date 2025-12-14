import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CoursesPage } from "./components";

test.describe("Courses search", () => {
	test("search returns results for known course title", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const query = "Методи розробки програмних систем";
		await coursesPage.searchByTitle(query);

		await expect
			.poll(async () => await coursesPage.getCourseCount())
			.toBeGreaterThan(0);

		await expect(page.getByTestId(testIds.courses.searchInput)).toHaveValue(
			query,
		);
		expect(new URL(page.url()).searchParams.get("q")).toBe(query);
	});
});
