import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { mockBackend } from "./fixtures/mockBackend";

const out = resolve(process.env.SHOT_DIR ?? "shots/ukma-data");

async function shot(page: Page, name: string) {
	mkdirSync(out, { recursive: true });
	// A sticky header lands mid-page in a full-page capture taken while scrolled.
	await page.evaluate(() => globalThis.scrollTo(0, 0));
	await page.screenshot({
		path: resolve(out, `${name}.png`),
		fullPage: true,
		animations: "disabled",
	});
}

const updated = "2030-09-01T07:00:00Z";
const page = <T>(items: T[]) => ({
	items,
	cursor: items.length,
	has_more: false,
	data_updated_at: updated,
});
const named = (prefix: string, names: string[]) =>
	names.map((name, index) => ({
		id: `${prefix}-${index + 1}`,
		name,
		saz_filter_id: null,
		change_no: index + 1,
		removed_at: null,
	}));
const reviewCase = (
	id: string,
	kind: string,
	status: string,
	subject: string,
	candidates: unknown,
	safeAnswer: unknown,
) => ({
	id,
	kind,
	subject_id: subject,
	candidates,
	safe_answer: safeAnswer,
	status,
	run_id: "run-test-3",
	decision_id: status === "decided" ? "dec-test-1" : null,
	opened_at: "2030-08-28T09:15:00Z",
	change_no: 40,
});

/** Invented UKMA Data pages in the proxy's snake_case shape. */
const UKMA_DATA: Record<string, unknown> = {
	"status/": {
		key_id: "key-test",
		scopes: ["catalog:read", "review:decide"],
		key_expires_at: "2031-01-01T00:00:00Z",
		data_updated_at: updated,
	},
	"terms/": page(
		[2029, 2030].map((year, index) => ({
			id: `term-${index + 1}`,
			code: `${year}-FALL`,
			academic_year: year,
			season: "FALL",
			change_no: index + 1,
		})),
	),
	"faculties/": page(named("fac", ["Факультет зразків", "Факультет тестів"])),
	"departments/": page(
		named("dep", ["Кафедра прикладів", "Кафедра макетів", "Кафедра схем"]),
	),
	"programmes/": page(named("prog", ["Програма А", "Програма Б"])),
	"offerings/": page(
		Array.from({ length: 6 }, (_, index) => ({
			id: `off-test-${index + 1}`,
			change_no: index + 1,
			removed_at: index === 5 ? updated : null,
		})),
	),
	"review-cases/": page([
		reviewCase(
			"case-test-1",
			"course_match",
			"open",
			"off-test-1",
			["off-test-2"],
			{ course: "new" },
		),
		reviewCase(
			"case-test-2",
			"instructor_match",
			"open",
			"off-test-3",
			["inst-test-1", "inst-test-2"],
			{ instructor: null },
		),
		reviewCase(
			"case-test-3",
			"removals_held",
			"decided",
			"run-test-2",
			{ offerings: ["off-test-4", "off-test-5"], threshold: 0.1 },
			{ removed: [] },
		),
	]),
};

async function mockUkmaData(page: Page, failure?: 502 | 503) {
	await page.route("**/api/v1/ukma-data/**", async (route) => {
		const path = new URL(route.request().url()).pathname.replace(
			/^\/api\/v1\/ukma-data\//,
			"",
		);
		if (failure) {
			await route.fulfill({
				status: failure,
				json: { detail: "shots", status: failure },
			});
			return;
		}
		const body = UKMA_DATA[path];
		await (body
			? route.fulfill({ json: body })
			: route.abort("connectionrefused"));
	});
}

const cases = (page: Page) =>
	page.getByRole("list", { name: "Справи на розгляд" }).getByRole("listitem");

for (const width of [1440, 390]) {
	test(`a student cannot open /data at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await mockBackend(page);
		await page.goto("/data/cases");
		await expect(
			page.getByRole("heading", { name: "Розділ лише для суперкористувачів" }),
		).toBeVisible();
		await shot(page, `no-access-${width}`);
	});

	test(`a superuser reads UKMA Data at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await mockBackend(page, { session: "superuser" });
		await mockUkmaData(page);

		await page.goto("/data");
		await expect(page.getByText("Відкриті справи: 2")).toBeVisible();
		const lists = page.getByLabel("Чинні рядки за списками");
		await expect(lists).toContainText("Пропозиції курсів5");
		await shot(page, `overview-${width}`);

		await page.getByRole("link", { name: "Справи", exact: true }).click();
		await expect(cases(page)).toHaveCount(2);
		await page.getByRole("combobox", { name: "Стан справи" }).click();
		await page.getByRole("option", { name: "Усі стани" }).click();
		await expect(cases(page)).toHaveCount(3);
		await shot(page, `cases-${width}`);

		await cases(page)
			.filter({ hasText: "off-test-3" })
			.getByRole("link")
			.click();
		await expect(page.getByText("inst-test-1, inst-test-2")).toBeVisible();
		await expect(page.getByText("тут лише перегляд")).toBeVisible();
		await shot(page, `case-instructor-${width}`);

		await page.goto("/data/cases/case-test-3");
		await expect(page.getByText('"threshold": 0.1')).toBeVisible();
		await shot(page, `case-removals-${width}`);
	});

	for (const failure of [502, 503] as const) {
		test(`UKMA Data ${failure} at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await mockBackend(page, { session: "superuser" });
			await mockUkmaData(page, failure);
			await page.goto("/data");
			await expect(
				page.getByText(
					failure === 502
						? "UKMA Data зараз недоступний"
						: "UKMA Data не налаштовано",
				),
			).toBeVisible();
			await shot(page, `down-${failure}-${width}`);
		});
	}
}
