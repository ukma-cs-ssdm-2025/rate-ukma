import { test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { writeFileSync } from "node:fs";

import { testIds } from "../../src/lib/test-ids";
import { COURSE } from "../shots/fixtures/data";
import { mockBackend } from "../shots/fixtures/mockBackend";

const RUNS = Number(process.env.PERF_RUNS ?? 3);
const CPU = Number(process.env.PERF_CPU ?? 4);
const ONLY = process.env.PERF_ONLY ? new RegExp(process.env.PERF_ONLY) : null;

type Scenario = {
	name: string;
	path: string;
	width: number;
	interact?: (page: Page) => Promise<void>;
};

const SCENARIOS: Scenario[] = [
	{
		name: "home",
		path: "/",
		width: 1440,
		interact: async (page) => {
			await page.getByTestId(testIds.courses.searchInput).click();
			await page.keyboard.type("алгоритми", { delay: 60 });
		},
	},
	{ name: "home-phone", path: "/", width: 390 },
	{ name: "course", path: `/courses/${COURSE.id}`, width: 1440 },
	{ name: "my-ratings", path: "/my-ratings", width: 1440 },
	{ name: "feed", path: "/feed", width: 1440 },
];

type Sample = {
	lcp: number;
	tbt: number;
	cls: number;
	inp: number;
	jsKB: number;
	jsFiles: number;
	api: number;
	duplicates: string[];
};

declare global {
	interface Window {
		__perf: {
			lcp: number;
			long: number[];
			cls: number;
			interactions: Record<number, number>;
		};
	}
}

function observe() {
	window.__perf = { lcp: 0, long: [], cls: 0, interactions: {} };
	const on = (type: string, fn: (e: PerformanceEntry) => void, extra = {}) =>
		new PerformanceObserver((list) => list.getEntries().forEach(fn)).observe({
			type,
			buffered: true,
			...extra,
		});
	on("largest-contentful-paint", (e) => (window.__perf.lcp = e.startTime));
	on("longtask", (e) => window.__perf.long.push(e.duration));
	on("layout-shift", (e) => {
		const shift = e as PerformanceEntry & {
			value: number;
			hadRecentInput: boolean;
		};
		if (!shift.hadRecentInput) {
			window.__perf.cls += shift.value;
		}
	});
	on(
		"event",
		(e) => {
			const { interactionId } = e as PerformanceEntry & {
				interactionId: number;
			};
			if (!interactionId) {
				return;
			}
			const seen = window.__perf.interactions[interactionId] ?? 0;
			window.__perf.interactions[interactionId] = Math.max(seen, e.duration);
		},
		{ durationThreshold: 16 },
	);
}

async function waitForLayoutSettled(page: Page): Promise<void> {
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				let quietTimer: number | undefined;
				let capTimer: number | undefined;
				const finish = () => {
					observer.disconnect();
					window.clearTimeout(quietTimer);
					window.clearTimeout(capTimer);
					resolve();
				};
				const observer = new PerformanceObserver(() => {
					window.clearTimeout(quietTimer);
					quietTimer = window.setTimeout(finish, 500);
				});
				observer.observe({ type: "layout-shift", buffered: true });
				quietTimer = window.setTimeout(finish, 500);
				capTimer = window.setTimeout(finish, 5000);
			}),
	);
}

async function measure(page: Page, scenario: Scenario): Promise<Sample> {
	await page.setViewportSize({ width: scenario.width, height: 900 });
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
	await page.addInitScript(observe);
	await mockBackend(page);

	const api: string[] = [];
	const js: Promise<number>[] = [];
	page.on("request", (request) => {
		const url = new URL(request.url());
		if (url.pathname.includes("/api/")) {
			api.push(`${request.method()} ${url.pathname}${url.search}`);
		}
	});
	page.on("response", (response) => {
		if (new URL(response.url()).pathname.endsWith(".js")) {
			js.push(
				response.body().then(
					(body) => body.length,
					() => 0,
				),
			);
		}
	});

	const response = await page.goto(scenario.path, { waitUntil: "networkidle" });
	if (!response?.ok()) {
		throw new Error(`${scenario.path} answered ${response?.status()}`);
	}
	await waitForLayoutSettled(page);
	if (scenario.interact) {
		await scenario.interact(page);
		await waitForLayoutSettled(page);
	}

	const vitals = await page.evaluate(() => {
		const { lcp, long, cls, interactions } = window.__perf;
		return {
			lcp,
			cls,
			tbt: long.reduce((sum, d) => sum + Math.max(0, d - 50), 0),
			inp: Math.max(0, ...Object.values(interactions)),
		};
	});
	if (!vitals.lcp) {
		throw new Error(`${scenario.path} never painted content`);
	}
	const sizes = await Promise.all(js);
	const counts = new Map<string, number>();
	for (const call of api) {
		counts.set(call, (counts.get(call) ?? 0) + 1);
	}

	return {
		...vitals,
		jsKB: sizes.reduce((sum, n) => sum + n, 0) / 1024,
		jsFiles: sizes.length,
		api: api.length,
		duplicates: [...counts].filter(([, n]) => n > 1).map(([call]) => call),
	};
}

const median = (values: number[]) =>
	[...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const rows: Record<string, string | number>[] = [];

test.describe.configure({ mode: "serial" });

for (const scenario of SCENARIOS) {
	if (ONLY && !ONLY.test(scenario.name)) {
		continue;
	}

	test(scenario.name, async ({ browser }) => {
		const samples: Sample[] = [];
		for (let run = 0; run < RUNS; run++) {
			const context = await browser.newContext();
			samples.push(await measure(await context.newPage(), scenario));
			await context.close();
		}
		const pick = (key: keyof Omit<Sample, "duplicates">) =>
			median(samples.map((sample) => sample[key]));
		rows.push({
			page: scenario.name,
			"LCP ms": Math.round(pick("lcp")),
			"TBT ms": Math.round(pick("tbt")),
			CLS: Number(pick("cls").toFixed(3)),
			"INP ms": !scenario.interact
				? ""
				: pick("inp")
					? Math.round(pick("inp"))
					: "<16",
			"JS kB": Math.round(pick("jsKB")),
			"JS files": pick("jsFiles"),
			"API calls": pick("api"),
			"duplicate calls": [
				...new Set(samples.flatMap((s) => s.duplicates)),
			].join(", "),
		});
	});
}

test.afterAll(() => {
	console.log(`\nMedians of ${RUNS} runs, CPU ${CPU}x, API mocked:`);
	console.table(rows);
	if (process.env.PERF_OUT) {
		writeFileSync(process.env.PERF_OUT, JSON.stringify(rows, null, "\t"));
	}
});
