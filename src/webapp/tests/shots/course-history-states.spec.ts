import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { COURSE } from "./fixtures/data";
import { mockBackend } from "./fixtures/mockBackend";
import type { HistorySample } from "./fixtures/mockBackend";
import { testIds } from "../../src/lib/test-ids";

// Variant A of the side panel on real course histories from prod.
const out = resolve(process.env.SHOT_DIR ?? "shots/course-history");

type State = {
	name: string;
	history: HistorySample;
	open?: (RegExp | string)[];
};

const STATES: State[] = [
	{ name: "01-new", history: "new" },
	{ name: "02-steady", history: "steady" },
	{ name: "03-steady-all", history: "steady", open: [/^ще \d/] },
	{ name: "04-general", history: "ukrainian" },
	{ name: "05-fall-spring", history: "practicum" },
	{ name: "06-term-moves", history: "mechanics", open: [/^ще \d/] },
	{ name: "07-credits", history: "calculus", open: [/^ще \d/] },
	{ name: "08-elective", history: "elective", open: [/^ще \d/] },
	{ name: "09-master", history: "master", open: [/^ще \d/] },
	{ name: "10-by-course", history: "statistics" },
	{
		name: "11-by-course-open",
		history: "statistics",
		open: [/курс|запис|спеціальн/],
	},
	{ name: "12-many", history: "culture" },
	{ name: "13-many-open", history: "culture", open: [/курс|запис|спеціальн/] },
	{ name: "14-many-open-2", history: "culture", open: [/: 5 записів/] },
];

async function open(page: Page, state: State, width: number, theme: string) {
	await page.setViewportSize({ width, height: 2400 });
	await page.addInitScript((value) => {
		localStorage.setItem("rate-ukma-theme", value);
	}, theme);
	await mockBackend(page, { history: state.history });
	await page.goto(`/courses/${COURSE.id}?panel=a`);
	await expect(page.getByTestId(testIds.courseDetails.title)).toBeVisible();
	const history = page
		.getByRole("region", { name: "Історія дисципліни" })
		.filter({ visible: true });
	await expect(history).toBeVisible();
	for (const label of state.open ?? []) {
		await history.getByRole("button", { name: label }).first().click();
	}
	await page.mouse.move(0, 0);
	await page.waitForTimeout(250);
	return history;
}

for (const theme of ["light", "dark"] as const) {
	for (const width of [1440, 390]) {
		for (const state of STATES) {
			test(`${state.name} ${theme} ${width}`, async ({ page }) => {
				const history = await open(page, state, width, theme);
				mkdirSync(out, { recursive: true });
				const device = width > 1000 ? "desktop" : "phone";
				await history.screenshot({
					path: resolve(out, `${state.name}-${device}-${theme}.png`),
					animations: "disabled",
				});
			});
		}
	}
}
