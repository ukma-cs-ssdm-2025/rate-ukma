import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
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

const rowRateButton = (page: Page, title: string) =>
	page
		.getByTestId(testIds.myRatings.card)
		.filter({ hasText: title })
		.getByRole("button", { name: "Оцінити", exact: true });

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
		// Every row already offers «Оцінити», so the page shows no suggestion card.
		await expect(page.getByTestId(testIds.myRatings.list)).toBeVisible();
		await expect(suggestions(page)).toHaveCount(0);
		await shot(page, `my-ratings-${width}`);

		await rowRateButton(page, "Бази даних").click();
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
		// The list already updates in place, so no way to another page here.
		await expect(
			thanks(page).getByRole("link", { name: /^Відкрити/ }),
		).toHaveCount(0);
		await expect(
			thanks(page).getByRole("button", { name: "Не зараз", exact: true }),
		).toBeVisible();

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

for (const width of [1440, 390]) {
	test(`rating another course from a course page offers to open it at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await mockBackend(page, { ratingSuggestions: "items", myCourses: "rated" });
		await page.goto(`/courses/${COURSE.id}`);
		await suggestions(page)
			.filter({ visible: true })
			.getByRole("button", { name: /^Оцінити «/ })
			.click();
		const rated = await page.getByTestId(testIds.rating.modalTitle).innerText();
		await score(page);
		await page.getByTestId(testIds.rating.submitButton).click();
		const open = thanks(page).getByRole("link", {
			name: `Відкрити «${rated}»`,
			exact: true,
		});
		await expect(open).toBeVisible();
		// No jump on its own: the user stays on the page they were reading.
		await expect(page).toHaveURL(new RegExp(`/courses/${COURSE.id}$`));
		await shot(page, `open-course-${width}`);
		await open.click();
		await expect(thanks(page)).toHaveCount(0);
		await expect(page).not.toHaveURL(new RegExp(`/courses/${COURSE.id}$`));
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(rated);
		await expect(page.getByText("Ваша оцінка", { exact: true })).toBeVisible();
	});
}

test("with nothing left, thanks closes with «Готово»", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockBackend(page, {
		ratingSuggestions: "empty",
		myCourses: "rateable",
	});
	await page.goto(`/courses/${COURSE.id}`);
	await page
		.getByRole("button", { name: "Оцінити дисципліну", exact: true })
		.click();
	await score(page);
	await page.getByTestId(testIds.rating.submitButton).click();
	await expect(
		thanks(page).getByText("Ви вже оцінили все доступне."),
	).toBeVisible();
	await shot(page, "all-rated-1440");
	await expect(
		thanks(page).getByRole("link", { name: /^Відкрити/ }),
	).toHaveCount(0);
	await thanks(page)
		.getByRole("button", { name: "Готово", exact: true })
		.click();
	await expect(thanks(page)).toHaveCount(0);
});

test("a failed save keeps the form and shows no thanks", async ({ page }) => {
	await mockBackend(page, { ratingSuggestions: "items", saveRating: "error" });
	await page.goto("/my-ratings");
	await rowRateButton(page, "Бази даних").click();
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
	await page
		.getByRole("button", { name: "Оцінити дисципліну", exact: true })
		.click();
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
			if (request.url().includes("/rating-suggestions/")) {
				requests.push(request.url());
			}
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
		if (rateFlow === "off") {
			await shot(page, "my-ratings-flag-off-1440");
		}
		await expect(suggestions(page)).toHaveCount(0);

		if (rateFlow === "off") {
			await page.goto(`/courses/${COURSE.id}`);
			await page
				.getByRole("button", { name: "Оцінити дисципліну", exact: true })
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
