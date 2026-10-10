import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { mockBackend } from "./fixtures/mockBackend";
import { COURSE } from "./fixtures/data";
import { testIds } from "../../src/lib/test-ids";

const out = resolve(process.env.SHOT_DIR ?? "shots/rating-suggestions");

async function shot(page: Page, name: string) {
	mkdirSync(out, { recursive: true });
	await page.screenshot({ path: resolve(out, `${name}.png`) });
}

async function score(page: Page) {
	await page
		.getByTestId(testIds.rating.difficultySlider)
		.getByRole("radio", { name: "3 з 5" })
		.click();
	await page
		.getByTestId(testIds.rating.usefulnessSlider)
		.getByRole("radio", { name: "4 з 5" })
		.click();
}

const suggestions = (page: Page) =>
	page.getByRole("region", { name: "Що оцінити далі" });
const thanks = (page: Page) => page.getByTestId("rating-saved-modal");

for (const width of [1440, 390]) {
	test(`save, thanks, one follow-up, then stop at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await mockBackend(page, { ratingSuggestions: "items" });

		await page.goto("/my-ratings");
		await expect(suggestions(page).getByRole("button")).toHaveCount(3);
		await shot(page, `my-ratings-${width}`);

		await page
			.getByRole("button", { name: "Оцінити «Бази даних»", exact: true })
			.click();
		await score(page);
		await page.getByTestId(testIds.rating.anonymousCheckbox).click();
		await page.getByTestId(testIds.rating.submitButton).click();

		await expect(
			thanks(page).getByRole("heading", { name: "Дякуємо за оцінку!" }),
		).toBeVisible();
		await expect(
			thanks(page).getByRole("button", { name: /^Оцінити «/ }),
		).toHaveCount(2);
		await shot(page, `thanks-${width}`);

		await thanks(page)
			.getByRole("button", { name: "Оцінити «Машинне навчання»", exact: true })
			.click();
		await expect(page).toHaveURL(/\/courses\/c-ml$/);
		await expect(page.getByTestId(testIds.rating.modalTitle)).toHaveText(
			"Машинне навчання",
		);
		// Fresh form; only the anonymity choice carries over.
		await expect(
			page
				.getByTestId(testIds.rating.difficultySlider)
				.locator('[aria-checked="true"]'),
		).toHaveCount(0);
		await expect(
			page.getByTestId(testIds.rating.anonymousCheckbox),
		).toBeChecked();
		await shot(page, `next-form-${width}`);

		await score(page);
		await page.getByTestId(testIds.rating.submitButton).click();
		await expect(page.getByText("Оцінку успішно додано")).toBeVisible();
		await page.clock.install();
		await page.clock.fastForward(2000);
		await expect(thanks(page)).toHaveCount(0);
	});
}

test("an already rated course offers one more", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockBackend(page, { ratingSuggestions: "items", myCourses: "rated" });
	await page.goto(`/courses/${COURSE.id}`);
	await expect(
		suggestions(page).filter({ visible: true }).getByRole("button"),
	).toHaveCount(1);
	await shot(page, "rated-course-1440");
});

test("a failed save keeps the form and shows no thanks", async ({ page }) => {
	await mockBackend(page, { ratingSuggestions: "items", saveRating: "error" });
	await page.goto("/my-ratings");
	await page
		.getByRole("button", { name: "Оцінити «Бази даних»", exact: true })
		.click();
	await score(page);
	await page.getByTestId(testIds.rating.submitButton).click();
	await expect(
		page.getByText("Не вдалося зберегти оцінку. Спробуйте ще раз"),
	).toBeVisible();
	await expect(page.getByTestId(testIds.rating.form)).toBeVisible();
	await expect(thanks(page)).toHaveCount(0);
});

test("thanks never interrupts a delete confirmation", async ({ page }) => {
	await mockBackend(page, {
		ratingSuggestions: "items",
		myCourses: "rateable",
	});
	await page.goto(`/courses/${COURSE.id}`);
	await page.getByRole("button", { name: "Оцінити курс", exact: true }).click();
	await score(page);
	await page.clock.install();
	await page.clock.pauseAt(new Date(Date.now() + 100));
	await page.getByTestId(testIds.rating.submitButton).click();
	// A paused clock also stalls React Query, so step it until the rating shows.
	await expect(async () => {
		await page.clock.runFor(50);
		await expect(page.getByText("Ваша оцінка", { exact: true })).toBeVisible({
			timeout: 250,
		});
	}).toPass();
	await page
		.getByRole("button", { name: "Видалити оцінку", exact: true })
		.click();
	await page.clock.fastForward(1000);
	await expect(page.getByRole("alertdialog")).toBeVisible();
	await expect(thanks(page)).toHaveCount(0);
});

for (const rateFlow of ["off", "pending"] as const) {
	test(`fe_rate_flow ${rateFlow}: the old flow, no suggestions requested`, async ({
		page,
	}) => {
		const requests: string[] = [];
		page.on("request", (request) => {
			if (request.url().includes("/rating-suggestions/"))
				requests.push(request.url());
		});
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockBackend(page, {
			ratingSuggestions: "items",
			myCourses: "rateable",
			rateFlow,
		});
		await page.goto("/my-ratings");
		await expect(
			page.getByRole("heading", { name: "Мої оцінки", exact: true }),
		).toBeVisible();
		if (rateFlow === "off") await shot(page, "my-ratings-flag-off-1440");
		await expect(suggestions(page)).toHaveCount(0);

		if (rateFlow === "off") {
			await page.goto(`/courses/${COURSE.id}`);
			await page
				.getByRole("button", { name: "Оцінити курс", exact: true })
				.click();
			await score(page);
			await page.getByTestId(testIds.rating.submitButton).click();
			await expect(page.getByText("Оцінку успішно додано")).toBeVisible();
			await page.clock.install();
			await page.clock.fastForward(1000);
			await expect(thanks(page)).toHaveCount(0);
		}
		expect(requests).toEqual([]);
	});
}
