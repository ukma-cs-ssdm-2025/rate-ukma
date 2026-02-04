import { expect, test } from "@playwright/test";

import { CourseDetailsPage } from "./course-details.page";
import { CoursesPage } from "./courses.page";

test.describe("Course Page", () => {
	let coursesPage: CoursesPage;
	let courseDetailsPage: CourseDetailsPage;

	test.beforeEach(async ({ page }) => {
		coursesPage = new CoursesPage(page);
		courseDetailsPage = new CourseDetailsPage(page);

		await coursesPage.goto();
	});

	test("courses page is loaded @smoke", async () => {
		expect(await coursesPage.isPageLoaded()).toBe(true);
	});

	test("navigates from courses page to course details page @smoke", async () => {
		await coursesPage.clickFirstCourseCard();
		expect(await courseDetailsPage.isPageLoaded()).toBe(true);
	});
});
