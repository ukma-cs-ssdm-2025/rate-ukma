import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { setFeatureFlagOverride } from "../e2e/shared/feature-flags";
import { testIds } from "../../src/lib/test-ids";
import { mockBackend } from "./fixtures/mockBackend";

const out = resolve(process.env.SHOT_DIR ?? "shots/ukma-data");

async function shot(page: Page, name: string) {
	mkdirSync(out, { recursive: true });
	await page.screenshot({
		path: resolve(out, `${name}.png`),
		fullPage: true,
		animations: "disabled",
		style: `[data-testid="${testIds.header.root}"]{position:static!important}`,
	});
}

const updated = "2030-09-01T07:00:00Z";
const page = <T>(items: T[]) => ({
	items,
	cursor: items.length,
	has_more: false,
	data_updated_at: updated,
	total: items.length,
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
};

const REVIEW_CASES = [
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
];

function reviewCasePage(url: URL) {
	const kind = url.searchParams.get("kind");
	const status = url.searchParams.get("status");
	return page(
		REVIEW_CASES.filter(
			(item) =>
				(kind === null || item.kind === kind) &&
				(status === null || item.status === status),
		),
	);
}

async function mockUkmaData(page: Page, failure?: 502 | 503) {
	await page.route("**/api/v1/ukma-data/**", async (route) => {
		const url = new URL(route.request().url());
		const path = url.pathname.replace(/^\/api\/v1\/ukma-data\//, "");
		if (failure) {
			await route.fulfill({
				status: failure,
				json: { detail: "shots", status: failure },
			});
			return;
		}
		const body =
			path === "review-cases/" ? reviewCasePage(url) : UKMA_DATA[path];
		if (body) {
			await route.fulfill({ json: body });
			return;
		}
		await (path.startsWith("sync/")
			? route.fulfill({ status: 404, json: { detail: "shots", status: 404 } })
			: route.abort("connectionrefused"));
	});
}

const caseRows = (page: Page) =>
	page
		.getByRole("table")
		.getByRole("row")
		.filter({ has: page.getByRole("link") });

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

	test(`/data is unavailable with the flag off at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await mockBackend(page, { session: "superuser" });
		await setFeatureFlagOverride(page, "fe_ukma_data", false);
		await page.goto("/data");
		await expect(page.getByText("Розділ наразі недоступний.")).toBeVisible();
		await expect(page.getByText("Щось пішло не так")).toHaveCount(0);
		await shot(page, `flag-off-${width}`);
	});

	test(`a superuser reads САЗ data at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await mockBackend(page, { session: "superuser" });
		await mockUkmaData(page);

		await page.goto("/data");
		await expect(
			page.getByText(/1 справа про дисципліну чекає рішення/),
		).toBeVisible();
		await expect(
			page.getByText(/1 справа про викладача чекає рішення/),
		).toBeVisible();
		await shot(page, `overview-${width}`);

		await page.getByRole("link", { name: "Справи", exact: true }).click();
		await expect(caseRows(page)).toHaveCount(2);
		await page.getByRole("radio", { name: /^Усі\s*3/ }).click();
		await expect(caseRows(page)).toHaveCount(3);
		await shot(page, `cases-${width}`);

		await page
			.getByRole("link", { name: "Викладача з САЗ не вдалося впізнати" })
			.click();
		await expect(page.getByText("2 схожі викладачі")).toBeVisible();
		await expect(
			page.getByText("Рішення ухвалюють у САЗ-даних; тут — перегляд."),
		).toBeVisible();
		await shot(page, `case-instructor-${width}`);

		await page.goto("/data/cases/case-test-3");
		await expect(
			page.getByRole("heading", { name: /САЗ більше не показує 2 семестри/ }),
		).toBeVisible();
		await shot(page, `case-removals-${width}`);
	});

	for (const failure of [502, 503] as const) {
		test(`САЗ data ${failure} at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await mockBackend(page, { session: "superuser" });
			await mockUkmaData(page, failure);
			await page.goto("/data");
			await expect(
				page.getByText(
					failure === 502
						? "Дані САЗ зараз недоступні"
						: "Доступ до даних САЗ не налаштовано",
				),
			).toBeVisible();
			await shot(page, `down-${failure}-${width}`);
		});
	}
}
