import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { mockBackend } from "./fixtures/mockBackend";

const out = resolve(process.env.SHOT_DIR ?? "shots/ukma-data");

// Dialogs are fixed to the viewport, so a full-page capture would misplace them.
async function shot(page: Page, name: string, fullPage = true) {
	mkdirSync(out, { recursive: true });
	// A sticky header lands mid-page in a full-page capture taken while scrolled.
	if (fullPage) await page.evaluate(() => globalThis.scrollTo(0, 0));
	await page.screenshot({
		path: resolve(out, `${name}.png`),
		fullPage,
		animations: "disabled",
	});
}

const cases = (page: Page) =>
	page.getByRole("list", { name: "Справи на розгляд" }).getByRole("listitem");
const trail = (page: Page) => page.getByRole("list", { name: "Журнал рішень" });

for (const width of [1440, 390]) {
	test(`a student cannot open /data at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await mockBackend(page);
		await page.goto("/data/cases");
		await expect(
			page.getByRole("heading", { name: "Розділ лише для суперкористувачів" }),
		).toBeVisible();
		await expect(page.getByText("Остання синхронізація")).toHaveCount(0);
		await shot(page, `no-access-${width}`);
	});

	test(`a superuser reviews and decides cases at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await mockBackend(page, { session: "superuser" });

		await page.goto("/data");
		await expect(page.getByText("Відкриті справи: 5")).toBeVisible();
		await shot(page, `overview-${width}`);

		await page.getByRole("link", { name: "Справи", exact: true }).click();
		await expect(cases(page)).toHaveCount(5);
		await page.getByRole("combobox", { name: "Тип справи" }).click();
		await page.getByRole("option", { name: "Утримані вилучення" }).click();
		await expect(cases(page)).toHaveCount(1);
		await page.getByRole("combobox", { name: "Стан справи" }).click();
		await page.getByRole("option", { name: "Усі стани" }).click();
		await expect(cases(page)).toHaveCount(2);
		await shot(page, `cases-removals-${width}`);

		await page.goto("/data/cases?kind=course_match&status=obsolete");
		await expect(page.getByText("Справ немає")).toBeVisible();
		await shot(page, `cases-empty-${width}`);

		await page.goto("/data/cases");
		await expect(cases(page)).toHaveCount(5);
		await shot(page, `cases-${width}`);
		await cases(page)
			.filter({ hasText: "Теорія демонстраційних систем" })
			.getByRole("link")
			.click();
		await expect(page.getByText("Можливо, той самий курс")).toBeVisible();
		await shot(page, `case-course-${width}`);

		await page.getByRole("button", { name: "Обʼєднати" }).click();
		await expect(page.getByRole("alertdialog")).toBeVisible();
		await shot(page, `case-course-confirm-${width}`, false);
		await page
			.getByRole("alertdialog")
			.getByRole("button", { name: "Обʼєднати" })
			.click();
		await expect(page.getByText("Рішення збережено")).toBeVisible();
		await expect(trail(page).getByText("Змінено рядків: 2")).toBeVisible();
		await expect(page.getByRole("button", { name: "Розділити" })).toBeVisible();
		await expect(page.getByText("Рішення збережено")).toBeHidden({
			timeout: 10_000,
		});
		await shot(page, `case-course-decided-${width}`);

		await page.goto("/data/cases/rev_03");
		const link = page.getByRole("button", { name: "Привʼязати викладача" });
		await expect(link).toBeDisabled();
		await page.getByLabel(/Зразок Олена Петрівна/).check();
		await expect(link).toBeEnabled();
		await shot(page, `case-instructor-${width}`);

		await page.goto("/data/cases/rev_04");
		await expect(page.getByText("і ще 206")).toBeVisible();
		await shot(page, `case-removals-${width}`);
	});
}
