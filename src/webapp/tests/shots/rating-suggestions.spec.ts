import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { mockBackend } from "./fixtures/mockBackend";
import { COURSE } from "./fixtures/data";
import { testIds } from "../../src/lib/test-ids";

const out = resolve(process.env.SHOT_DIR ?? "shots/rating-suggestions");
async function shot(page: Page, name: string) {
	mkdirSync(out, { recursive: true });
	const target = page.getByRole("dialog");
	await ((await target.count()) ? target : page).screenshot({
		path: resolve(out, `${name}.png`),
		fullPage: true,
	});
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
for (const width of [1440, 390]) {
	test(`named invitation and optional continuation at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.addInitScript(() =>
			localStorage.setItem("rate-ukma-theme", "light"),
		);
		await mockBackend(page, { ratingSuggestions: "items" });
		await page.goto("/");
		const invitation = page.getByRole("region", {
			name: "Дисципліни до оцінювання",
		});
		await expect(invitation).toHaveCount(0);
		await shot(page, `home-${width}`);
		await page.goto("/my-ratings");
		await expect(invitation.getByRole("button")).toHaveCount(3);
		await shot(page, `my-ratings-${width}`);
		await page
			.getByRole("button", { name: "Оцінити «Бази даних»", exact: true })
			.click();
		await expect(page.getByTestId(testIds.rating.form)).toBeVisible();
		await shot(page, `form-${width}`);
		await score(page);
		await page.getByTestId(testIds.rating.anonymousCheckbox).click();
		const save = page.waitForRequest(
			(request) =>
				request.method() === "POST" && request.url().includes("/c-db/ratings/"),
		);
		await page.getByTestId(testIds.rating.submitButton).click();
		expect((await save).postDataJSON()).toMatchObject({
			course_offering: "offering-c-db",
			difficulty: 3,
			usefulness: 4,
			is_anonymous: true,
		});
		await expect(
			page
				.locator('[data-testid="rating-saved-modal"][data-state="open"]')
				.getByRole("heading", { name: "Дякуємо за вашу оцінку!" }),
		).toBeVisible();
		const next = page.getByRole("region", { name: "Що оцінити далі" });
		await expect(next.getByRole("button")).toHaveCount(2);
		await expect(next.getByText("Бази даних", { exact: true })).toHaveCount(0);
		await shot(page, `thanks-${width}`);
		await next
			.getByRole("button", { name: "Оцінити «Машинне навчання»", exact: true })
			.click();
		await expect(page).toHaveURL(/\/courses\/c-ml$/);
		await expect(page.getByTestId(testIds.rating.modalTitle)).toHaveText(
			"Машинне навчання",
		);
		await expect(
			page
				.getByTestId(testIds.rating.difficultySlider)
				.locator('[aria-checked="true"]'),
		).toHaveCount(0);
		await expect(
			page
				.getByTestId(testIds.rating.usefulnessSlider)
				.locator('[aria-checked="true"]'),
		).toHaveCount(0);
		await expect(
			page.getByTestId(testIds.rating.anonymousCheckbox),
		).toBeChecked();
		await shot(page, `next-form-${width}`);
		await score(page);
		await page.getByTestId(testIds.rating.submitButton).click();
		await expect(page).toHaveURL(/\/courses\/c-ml$/);
		await expect(page.getByText("Ваша оцінка", { exact: true })).toBeVisible();
		await page.clock.install();
		await page.clock.fastForward(2000);
		await expect(page.getByTestId("rating-saved-modal")).toHaveCount(0);
		await expect(
			page.getByRole("region", { name: "Дисципліни до оцінювання" }),
		).toHaveCount(0);
		await shot(page, `follow-up-saved-${width}`);
	});
}
test("save failure preserves form and never thanks the user", async ({
	page,
}) => {
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
	await expect(
		page
			.locator('[data-testid="rating-saved-modal"][data-state="open"]')
			.getByRole("heading", { name: "Дякуємо за вашу оцінку!" }),
	).toHaveCount(0);
});
test("empty suggestions do not add an invitation", async ({ page }) => {
	await mockBackend(page);
	await page.goto("/my-ratings");
	await expect(
		page.getByRole("heading", { name: "Мої оцінки", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Дисципліни до оцінювання" }),
	).toHaveCount(0);
});

test("rated course offers one next subject", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockBackend(page, { ratingSuggestions: "items", myCourses: "rated" });
	await page.goto(`/courses/${COURSE.id}`);
	const invitation = page
		.getByRole("region", { name: "Дисципліни до оцінювання" })
		.filter({ visible: true });
	await expect(invitation.getByRole("button")).toHaveCount(1);
	await shot(page, "rated-course-1440");
});
test("suggestion error still confirms a successful save", async ({ page }) => {
	await mockBackend(page, {
		ratingSuggestions: "error",
		myCourses: "rateable",
	});
	await page.goto(`/courses/${COURSE.id}`);
	await page
		.getByRole("button", { name: /^Оцінити дисципліну$/ })
		.first()
		.click();
	await score(page);
	await page.getByTestId(testIds.rating.submitButton).click();
	await expect(
		page
			.locator('[data-testid="rating-saved-modal"][data-state="open"]')
			.getByRole("heading", { name: "Дякуємо за вашу оцінку!" }),
	).toBeVisible();
	await expect(
		page.getByTestId("rating-saved-modal").locator('[data-slot="skeleton"]'),
	).toHaveCount(0, { timeout: 30000 });
	await expect(
		page.getByText("Усі доступні вам дисципліни вже оцінено."),
	).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Close", exact: true }),
	).toBeVisible();
});
test("dark confirmation", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() =>
		localStorage.setItem("rate-ukma-theme", "dark"),
	);
	await mockBackend(page, { ratingSuggestions: "items" });
	await page.goto("/my-ratings");
	await page
		.getByRole("button", { name: "Оцінити «Бази даних»", exact: true })
		.click();
	await score(page);
	await page.getByTestId(testIds.rating.submitButton).click();
	await expect(
		page
			.locator('[data-testid="rating-saved-modal"][data-state="open"]')
			.getByRole("heading", { name: "Дякуємо за вашу оцінку!" }),
	).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Що оцінити далі" }).getByRole("button"),
	).toHaveCount(2);
	await shot(page, "thanks-dark-390");
});

test("rating from a filtered overview removes the saved row before showing thanks", async ({
	page,
}) => {
	await mockBackend(page, { ratingSuggestions: "items" });
	await page.goto("/my-ratings");
	await page.getByRole("button", { name: /Лише неоцінені/ }).click();
	const card = page
		.getByTestId(testIds.myRatings.card)
		.filter({ hasText: "Бази даних" });
	await card.getByRole("button", { name: "Оцінити", exact: true }).click();
	await score(page);
	await page.getByTestId(testIds.rating.submitButton).click();
	await expect(
		page
			.locator('[data-testid="rating-saved-modal"][data-state="open"]')
			.getByRole("heading", { name: "Дякуємо за вашу оцінку!" }),
	).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Що оцінити далі" }).getByRole("button"),
	).toHaveCount(2);
	await page.getByRole("button", { name: "Close", exact: true }).click();
	await expect(card).toHaveCount(0);
});

for (const state of ["none", "rateable", "not-yet"] as const) {
	test(`course browsing has no invitation when enrollment state is ${state}`, async ({
		page,
	}) => {
		await mockBackend(page, { ratingSuggestions: "items", myCourses: state });
		await page.goto(`/courses/${COURSE.id}`);
		await expect(
			page.getByRole("heading", { name: COURSE.title, exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole("region", { name: "Дисципліни до оцінювання" }),
		).toHaveCount(0);
	});
}

test("course refresh is visible before the delayed thank-you popup", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockBackend(page, {
		ratingSuggestions: "items",
		myCourses: "rateable",
	});
	await page.goto(`/courses/${COURSE.id}`);
	await page
		.getByRole("button", { name: "Оцінити дисципліну", exact: true })
		.click();
	await score(page);
	const saved = page.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			response.url().includes("/ratings/"),
	);
	await page.getByTestId(testIds.rating.submitButton).click();
	await saved;
	await expect(page.getByTestId(testIds.rating.modal)).toHaveCount(0);
	await expect(page.getByText("Ваша оцінка", { exact: true })).toBeVisible();
	await expect(page.getByTestId("rating-saved-modal")).toHaveCount(0);
	await expect(
		page.getByRole("region", { name: "Дисципліни до оцінювання" }),
	).toHaveCount(0);
	const updated = Date.now();
	await page.screenshot({
		path: resolve(out, "updated-course-1440.png"),
		animations: "disabled",
	});
	await expect(page.getByTestId("rating-saved-modal")).toBeVisible();
	expect(Date.now() - updated).toBeGreaterThanOrEqual(300);
	await expect(
		page.getByRole("region", { name: "Що оцінити далі" }).getByRole("button"),
	).toHaveCount(2);
	await page.getByRole("button", { name: "Close", exact: true }).click();
	await expect(
		page.getByRole("region", { name: "Дисципліни до оцінювання" }),
	).toHaveCount(0);
	await page.reload();
	await expect(
		page
			.getByRole("region", { name: "Дисципліни до оцінювання" })
			.getByRole("button"),
	).toHaveCount(1);
});

test("navigating during the pause cancels the thank-you popup", async ({
	page,
}) => {
	await mockBackend(page, {
		ratingSuggestions: "items",
		myCourses: "rateable",
	});
	await page.goto(`/courses/${COURSE.id}`);
	await page
		.getByRole("button", { name: "Оцінити дисципліну", exact: true })
		.click();
	await score(page);
	await page.getByTestId(testIds.rating.submitButton).click();
	await expect(page.getByText("Ваша оцінка", { exact: true })).toBeVisible();
	await page
		.getByRole("link", { name: "Дисципліни", exact: true })
		.first()
		.click();
	await expect(page).toHaveURL(/\/$/);
	await page.clock.install();
	await page.clock.fastForward(1000);
	await expect(page.getByTestId("rating-saved-modal")).toHaveCount(0);
});
