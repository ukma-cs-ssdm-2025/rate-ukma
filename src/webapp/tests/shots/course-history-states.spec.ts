import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { COURSE } from "./fixtures/data";
import { mockBackend } from "./fixtures/mockBackend";
import type { MockOptions } from "./fixtures/mockBackend";
import { testIds } from "../../src/lib/test-ids";

// Variant A of the side panel: every shape the course history can take.
const out = resolve(process.env.SHOT_DIR ?? "shots/course-history");

type State = {
	name: string;
	history: NonNullable<MockOptions["history"]>;
	open?: (RegExp | string)[];
};

const STATES: State[] = [
	{ name: "1-new", history: "new" },
	{ name: "2-steady", history: "steady" },
	{ name: "3-steady-all", history: "steady", open: ["ще 2"] },
	{ name: "4-changes", history: "changes" },
	{ name: "5-changes-all", history: "changes", open: ["ще 2"] },
	{ name: "6-streams", history: "streams" },
	{
		name: "7-streams-open",
		history: "streams",
		open: [/3 потоки/, /2 потоки/],
	},
	{
		name: "8-many-streams-open",
		history: "mixed",
		open: ["ще 3", /20 потоків/],
	},
];

async function open(page: Page, state: State, width: number, theme: string) {
	await page.setViewportSize({ width, height: 2200 });
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
		await history.getByRole("button", { name: label }).click();
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
