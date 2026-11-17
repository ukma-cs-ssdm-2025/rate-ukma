import { expect, test } from "@playwright/test";
import { mockBackend } from "./fixtures/mockBackend";
import { COURSES } from "./fixtures/data";
import { testIds } from "../../src/lib/test-ids";

test("the reviews sort is remembered on the next course page", async ({
	page,
}) => {
	await mockBackend(page);
	const reviews = page.getByTestId(testIds.courseDetails.reviewsSection);
	const sort = reviews.getByRole("combobox");
	const firstReview = reviews
		.getByTestId(testIds.courseDetails.reviewCard)
		.first();

	await page.goto(`/courses/${COURSES[0].id}`);
	await expect(sort).toHaveText("Найпопулярніші");
	await expect(firstReview).not.toContainText("Остап Л.");

	await sort.click();
	await page.getByRole("option", { name: "Найстаріші" }).click();
	await expect(sort).toHaveText("Найстаріші");
	await expect(firstReview).toContainText("Остап Л.");

	await page.goto(`/courses/${COURSES[1].id}`);
	await expect(sort).toHaveText("Найстаріші");

	await page.reload();
	await expect(sort).toHaveText("Найстаріші");
	await expect(firstReview).toContainText("Остап Л.");
});
