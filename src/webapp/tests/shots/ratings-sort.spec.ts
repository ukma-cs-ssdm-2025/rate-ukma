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

	await page.goto(`/courses/${COURSES[0].id}`);
	await expect(sort).toHaveText("Найпопулярніші");

	await sort.click();
	await page.getByRole("option", { name: "Найстаріші" }).click();
	await expect(sort).toHaveText("Найстаріші");

	await page.goto(`/courses/${COURSES[1].id}`);
	await expect(sort).toHaveText("Найстаріші");

	await page.reload();
	await expect(sort).toHaveText("Найстаріші");
});
