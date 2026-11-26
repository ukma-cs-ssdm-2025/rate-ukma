import type { Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { expect, test } from "../framework/fixtures";
import { setFeatureFlagOverride } from "../shared/feature-flags";

const IN_PLAN = "У вашому ІНП";
const CANDIDATES_TO_TRY = 5;

async function openCourseNotInPlan(
	page: Page,
	openNthCourse: (nth: number) => Promise<void>,
): Promise<string> {
	for (let nth = 0; nth < CANDIDATES_TO_TRY; nth++) {
		await page.goto("/my-ratings");
		await openNthCourse(nth);
		const title = page.getByTestId(testIds.courseDetails.title);
		await expect(title).toBeVisible();
		const addButton = page.getByTestId(testIds.personalPlan.addToPlanButton);
		await expect(addButton.or(page.getByText(IN_PLAN)).first()).toBeVisible();
		if (await addButton.isVisible()) {
			return (await title.innerText()).trim();
		}
	}
	throw new Error("Every candidate course is already in the plan");
}

test.describe("Personal plan (US-5.1, US-5.10a)", () => {
	test.beforeEach(async ({ page }) => {
		await setFeatureFlagOverride(page, "fe_personal_plan", true);
	});

	test("a course added from its page appears in the plan and can be removed again @smoke", async ({
		page,
		myRatingsPage,
	}) => {
		const title = await openCourseNotInPlan(page, (nth) =>
			myRatingsPage.openFirstCourseToRate(nth),
		);
		const courseUrl = page.url();
		let removed = false;

		try {
			await page.getByTestId(testIds.personalPlan.addToPlanButton).click();
			const dialog = page.getByTestId(testIds.personalPlan.addToPlanDialog);
			await expect(dialog).toBeVisible();
			await dialog.getByRole("button", { name: "Додати", exact: true }).click();

			await expect(page.getByText(IN_PLAN)).toBeVisible();
			await expect(
				page.getByTestId(testIds.personalPlan.addToPlanButton),
			).toHaveCount(0);

			await page.goto("/plan");
			await expect(page.getByTestId(testIds.personalPlan.page)).toBeVisible();
			const removeButton = page.getByRole("button", {
				name: `Прибрати ${title}`,
			});
			await expect(removeButton.first()).toBeVisible();

			await removeButton.first().click();
			await expect(removeButton).toHaveCount(0);
			removed = true;

			await page.goto(courseUrl);
			await expect(
				page.getByTestId(testIds.personalPlan.addToPlanButton),
			).toBeVisible();
		} finally {
			if (!removed) {
				await page.goto(courseUrl);
				const change = page.getByRole("button", { name: "Змінити" });
				if (await change.isVisible()) {
					await change.click();
					await page.getByRole("button", { name: "Прибрати з ІНП" }).click();
				}
			}
		}
	});
});
