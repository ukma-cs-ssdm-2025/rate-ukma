import { expect, test, type Page } from "@playwright/test";

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { testIds } from "../../src/lib/test-ids";
import { COURSE } from "./fixtures/data";
import { mockBackend } from "./fixtures/mockBackend";

/**
 * Screenshot every state of the webapp at desktop and phone widths, light and
 * dark, against a route-mocked backend with invented data:
 *
 *   pnpm shots                                   # shots/<state>-<width>-<theme>.png + index.html
 *   SHOT_BEFORE_DIR=/tmp/before pnpm shots       # index.html pairs before | after
 *   SHOT_BASE_URL=http://127.0.0.1:3100 pnpm shots   # drive a server that is already running
 *   SHOT_ONLY=feed pnpm shots                    # states whose name matches the regex
 */
const out = process.env.SHOT_DIR ? resolve(process.env.SHOT_DIR) : "";
const beforeDir = process.env.SHOT_BEFORE_DIR
	? resolve(process.env.SHOT_BEFORE_DIR)
	: "";
const only = process.env.SHOT_ONLY ? new RegExp(process.env.SHOT_ONLY) : null;
test.skip(!out, "screenshot helper; run `pnpm shots`");

const WIDTHS = [
	{ name: "desktop", width: 1440, height: 900 },
	{ name: "phone", width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;

// Fixture timestamps are relative to this instant, so "3 год тому" is stable.
const NOW = new Date("2026-09-16T09:00:00Z");

// Failed queries retry with backoff (2s + 4s + 8s) before the error UI shows.
const ERROR_TIMEOUT = 30_000;

interface State {
	readonly name: string;
	readonly note: string;
	readonly run: (page: Page) => Promise<void>;
}

const feedStrip = (page: Page) =>
	page.getByRole("region", { name: "Стрічка оновлень" });

const ALL_STATES: ReadonlyArray<State> = [
	{
		name: "home",
		note: "Courses page with the feed strip: pinned promos, reviews, a comment",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/");
			await feedStrip(page).getByText("Студентський хакатон").waitFor();
			await page.getByText(COURSE.title).first().waitFor();
		},
	},
	{
		name: "home-feed-scrolled",
		note: "Feed strip after one press of «Наступні» (builds without arrows show the start)",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/");
			await feedStrip(page).getByText("Студентський хакатон").waitFor();
			const next = page.getByRole("button", { name: "Наступні" });
			if (await next.isVisible()) await next.click({ timeout: 5_000 });
		},
	},
	{
		name: "feed",
		note: "/feed with banner promos, reviews and a comment",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/feed");
			await page.getByTestId("feed-list").waitFor();
		},
	},
	{
		name: "feed-empty",
		note: "/feed with no items",
		run: async (page) => {
			await mockBackend(page, { feed: "empty" });
			await page.goto("/feed");
			await page.getByTestId("feed-empty-state").waitFor();
		},
	},
	{
		name: "feed-error",
		note: "/feed when the feed endpoint answers 500",
		run: async (page) => {
			await mockBackend(page, { feed: "error" });
			await page.goto("/feed");
			await page
				.getByTestId("feed-error-state")
				.waitFor({ timeout: ERROR_TIMEOUT });
		},
	},
	{
		name: "courses-error",
		note: "Courses page when the course list answers 500",
		run: async (page) => {
			await mockBackend(page, { courses: "error" });
			await page.goto("/");
			await page
				.getByTestId("courses-error-state")
				.waitFor({ timeout: ERROR_TIMEOUT });
		},
	},
	{
		name: "my-ratings",
		note: "Мої оцінки with rated and unrated courses across two years",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/my-ratings");
			await page.getByTestId("my-ratings-list").waitFor();
		},
	},
	{
		name: "my-ratings-empty",
		note: "Мої оцінки for a student with no courses",
		run: async (page) => {
			await mockBackend(page, { grades: "empty" });
			await page.goto("/my-ratings");
			await page.getByTestId("my-ratings-empty-state").waitFor();
		},
	},
	{
		name: "course",
		note: "Course page with offerings and reviews",
		run: async (page) => {
			await mockBackend(page);
			await page.goto(`/courses/${COURSE.id}`);
			await page
				.getByRole("heading", { level: 1, name: COURSE.title })
				.waitFor();
			await page.getByText("Лекції насичені").first().waitFor();
		},
	},
	{
		name: "course-caz",
		note: "Course page with every САЗ year shown with a multi-speciality year",
		run: async (page) => {
			await mockBackend(page);
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByRole("button", { name: /^ще \d/ }).click();
			await page.getByText("2020–2021").first().waitFor();
		},
	},
	{
		name: "course-speciality-tooltip",
		note: "Hovering a САЗ speciality badge names the speciality and its type",
		run: async (page) => {
			await mockBackend(page);
			await page.goto(`/courses/${COURSE.id}`);
			await page
				.locator('[data-slot="tooltip-trigger"]', { hasText: /^ІПЗ/ })
				.first()
				.hover();
			await page.getByRole("tooltip").waitFor();
		},
	},
	{
		name: "notifications",
		note: "Notifications open: two new, two earlier",
		run: async (page) => {
			await mockBackend(page, { notifications: "items" });
			await page.goto("/");
			if ((page.viewportSize()?.width ?? 0) < 768) {
				await page.getByRole("button", { name: "Відкрити меню" }).click();
				await page.getByRole("button", { name: "Відкрити сповіщення" }).click();
			} else {
				await page.getByRole("button", { name: /^Сповіщення/ }).click();
			}
			await page.getByText("Хтось вподобав ваш відгук").waitFor();
		},
	},
	{
		name: "rating-modal",
		note: "Course page with the rating form open",
		run: async (page) => {
			await mockBackend(page, { myCourses: "rateable" });
			await page.goto(`/courses/${COURSE.id}`);
			await page
				.getByRole("heading", { level: 1, name: COURSE.title })
				.waitFor();
			await page.getByTestId("course-details-rate-button").click();
			await page.getByTestId("rating-modal").waitFor();
		},
	},
	{
		name: "course-rateable",
		note: "Attendee who can rate and has not yet: primary rate action",
		run: async (page) => {
			await mockBackend(page, { myCourses: "rateable" });
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByTestId("course-details-rate-button").waitFor();
		},
	},
	{
		name: "course-rate-soon",
		note: "Attendee before midterm: rating opens later, the reason is visible",
		run: async (page) => {
			await mockBackend(page, { myCourses: "not-yet" });
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByText("Оцінювання стане доступним").waitFor();
		},
	},
	{
		name: "course-rated",
		note: "Attendee who already rated: status and edit next to the scores",
		run: async (page) => {
			await mockBackend(page, { myCourses: "rated" });
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByText("Ви оцінили цей курс").waitFor();
		},
	},
	...(
		[
			["guest", "none", "a student who never took it: who leaves reviews"],
			["soon", "not-yet", "an attendee before midterm: when reviews open"],
			["rateable", "rateable", "an attendee who can rate: invited to go first"],
		] as const
	).map(([suffix, myCourses, who]) => ({
		name: `course-no-reviews-${suffix}`,
		note: `Unreviewed course seen by ${who}`,
		run: async (page: Page) => {
			await mockBackend(page, { myCourses, reviews: "empty" });
			await page.goto(`/courses/${COURSE.id}`);
			// Phones stack «Про курс» above the reviews, so bring the empty state up.
			await page.getByText("Відгуків ще немає").scrollIntoViewIfNeeded();
		},
	})),
	{
		name: "course-comments",
		note: "Course page with the first review's comment thread expanded",
		run: async (page) => {
			await mockBackend(page, { comments: "thread" });
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByText("Лекції насичені").first().waitFor();
			const toggle = page.getByTestId("rating-comments-toggle-button").first();
			if (await toggle.isVisible()) await toggle.click({ timeout: 5_000 });
			await page.getByTestId("rating-comments-item").first().waitFor();
			const replies = page.getByRole("button", { name: /відповідь/ }).first();
			if (await replies.isVisible()) await replies.click({ timeout: 5_000 });
			await page
				.getByText("останні дві домашки обʼємні", { exact: false })
				.waitFor();
		},
	},
	{
		name: "filters-drawer",
		note: "Home page with the mobile filters drawer open (desktop shows the filters panel)",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/");
			await page.getByText(COURSE.title).first().waitFor();
			const trigger = page.getByTestId(testIds.filters.drawerTrigger);
			if (await trigger.isVisible()) {
				await trigger.click({ timeout: 5_000 });
				await page.getByTestId(testIds.filters.drawer).waitFor();
			} else {
				await page.getByTestId(testIds.filters.panel).scrollIntoViewIfNeeded();
				await page.getByTestId(testIds.filters.panel).waitFor();
			}
		},
	},
	{
		name: "course-reply",
		note: "Reply form opened under a comment with «Відповісти»",
		run: async (page) => {
			await mockBackend(page, { comments: "thread" });
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByText("Лекції насичені").first().waitFor();
			await page.getByTestId("rating-comments-toggle-button").first().click();
			const comment = page.getByTestId("rating-comments-item").first();
			await comment.getByRole("button", { name: "Відповісти" }).click();
			await page.getByPlaceholder("Напишіть відповідь").waitFor();
		},
	},
	{
		name: "home-filtered",
		note: "Home page with difficulty 1–3 and autumn filters applied",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/?diff=1-3&term=FALL");
			await page.getByText(COURSE.title).first().waitFor();
		},
	},
	{
		name: "explore",
		note: "/explore with the scatter plot",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/explore");
			await page
				.getByLabel("Діаграма розподілу курсів за корисністю та складністю")
				.waitFor();
		},
	},
	{
		name: "explore-zoomed",
		note: "/explore after one press of the zoom-in control",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/explore");
			await page
				.getByLabel("Діаграма розподілу курсів за корисністю та складністю")
				.waitFor();
			const zoomIn = page.getByRole("button", { name: /Збільшити|Наблизити/ });
			if (await zoomIn.first().isVisible())
				await zoomIn.first().click({ timeout: 5_000 });
		},
	},
];
const STATES = ALL_STATES.filter((state) => !only || only.test(state.name));

const fileName = (state: string, width: string, theme: string) =>
	`${state}-${width}-${theme}.png`;

for (const width of WIDTHS) {
	for (const theme of THEMES) {
		for (const state of STATES) {
			test(`${state.name} @ ${width.name} ${theme}`, async ({ page }) => {
				await page.setViewportSize({
					width: width.width,
					height: width.height,
				});
				await page.clock.setFixedTime(NOW);
				await page.addInitScript((value) => {
					localStorage.setItem("rate-ukma-theme", value);
				}, theme);
				await state.run(page);
				await expect(page.locator("html")).toHaveClass(new RegExp(theme));
				await page.waitForTimeout(300);
				mkdirSync(out, { recursive: true });
				await page.screenshot({
					path: join(out, fileName(state.name, width.name, theme)),
					animations: "disabled",
				});
			});
		}
	}
}

// One contact sheet, so a reviewer opens a single page.
test.afterAll(() => {
	if (!out) return;
	mkdirSync(out, { recursive: true });
	if (beforeDir) mkdirSync(join(out, "before"), { recursive: true });

	const views = WIDTHS.flatMap((width) =>
		THEMES.map((theme) => ({ id: `${width.name}-${theme}`, width, theme })),
	);
	const figure = (src: string, caption: string) =>
		`<figure><img src="${src}" alt="${caption}" loading="lazy"><figcaption>${caption}</figcaption></figure>`;
	const tabs = views
		.map(
			(view, index) =>
				`<button role="tab" id="tab-${view.id}" aria-controls="panel-${view.id}" aria-selected="${index === 0}">${view.width.name} ${view.width.width}px, ${view.theme}</button>`,
		)
		.join("");
	const panels = views
		.map((view, index) => {
			const sections = STATES.map((state) => {
				const name = fileName(state.name, view.width.name, view.theme);
				const before = beforeDir ? join(beforeDir, name) : "";
				if (before && existsSync(before)) {
					copyFileSync(before, join(out, "before", name));
				}
				const row = beforeDir
					? (existsSync(before)
							? figure(`before/${name}`, "before")
							: "<figure><p>no before shot</p></figure>") +
						figure(name, "after")
					: figure(name, `${view.width.name}, ${view.theme}`);
				return `<section><h2>${state.name}</h2><p>${state.note}</p><div class="row${beforeDir ? " pair" : ""}">${row}</div></section>`;
			}).join("\n");
			return `<div role="tabpanel" id="panel-${view.id}" aria-labelledby="tab-${view.id}"${index === 0 ? "" : " hidden"}>${sections}</div>`;
		})
		.join("\n");

	writeFileSync(
		join(out, "index.html"),
		`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>rate-ukma shots</title>
<style>body{font:14px system-ui;margin:24px;background:#f4f4f5;color:#1c1c1e;overflow-x:clip}h1{margin:0 0 4px}.sub{margin:0 0 16px;color:#555}[role=tablist]{display:flex;flex-wrap:wrap;gap:8px;position:sticky;top:0;padding:12px 0;background:#f4f4f5;z-index:1}[role=tab]{border:1px solid #ccc;background:#fff;border-radius:999px;padding:8px 16px;font:inherit;cursor:pointer}[role=tab][aria-selected=true]{background:#1c1c1e;color:#fff;border-color:#1c1c1e}.row{display:flex;flex-direction:column;gap:24px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}figure{margin:0;min-width:0}img{max-width:100%;max-height:80vh;border:1px solid #ccc;background:#fff}figcaption{font-size:12px;color:#666;margin-top:4px}@media(max-width:760px){body{margin:12px}.pair{grid-template-columns:1fr}}</style>
<h1>rate-ukma, every state</h1>
<p class="sub">${STATES.length} states${beforeDir ? ", before | after" : ""}. Tabs switch width and theme; arrow keys work too.</p>
<div role="tablist" aria-label="View">${tabs}</div>
${panels}
<script>
const tabs=[...document.querySelectorAll('[role=tab]')];
const panels=[...document.querySelectorAll('[role=tabpanel]')];
function pick(i){tabs.forEach((t,j)=>t.setAttribute('aria-selected',String(j===i)));panels.forEach((p,j)=>{p.hidden=j!==i});location.hash=tabs[i].id}
tabs.forEach((t,i)=>{t.addEventListener('click',()=>pick(i));t.addEventListener('keydown',e=>{if(e.key==='ArrowRight')pick((i+1)%tabs.length);if(e.key==='ArrowLeft')pick((i-1+tabs.length)%tabs.length)})});
const start=tabs.findIndex(t=>t.id===location.hash.slice(1));if(start>=0)pick(start);
</script>`,
	);
});
