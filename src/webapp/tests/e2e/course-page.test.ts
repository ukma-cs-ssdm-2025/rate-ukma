import { expect, test } from "@playwright/test";

import { CourseDetailsPage, CoursesPage } from "./components";

test.describe("Course Page", () => {
	let coursesPage: CoursesPage;
	let courseDetailsPage: CourseDetailsPage;

	test.beforeEach(async ({ page }) => {
		coursesPage = new CoursesPage(page);
		courseDetailsPage = new CourseDetailsPage(page);

		await coursesPage.goto();
	});

	test("courses page is loaded", async () => {
		expect(await coursesPage.isPageLoaded()).toBe(true);
	});

	test("navigates from courses page to course details page", async () => {
		const courseTitle = await coursesPage.navigateToFirstCourseDetailsPage();
		expect(await courseDetailsPage.isPageLoaded()).toBe(true);
		expect(await courseDetailsPage.isTitleVisible(courseTitle)).toBe(true);
	});
});
