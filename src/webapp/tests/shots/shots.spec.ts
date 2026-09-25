import { expect, test, type Page } from "@playwright/test";

import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
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
 *   pnpm shots:compare [ref]                     # base ref (origin/main) vs working tree
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
	/** Gallery group, in the order sections first appear below. */
	readonly section: string;
	readonly note: string;
	/** Widths the state exists at; all by default. */
	readonly widths?: ReadonlyArray<(typeof WIDTHS)[number]["name"]>;
	readonly run: (page: Page) => Promise<void>;
}

const dialog = (page: Page) =>
	page.locator('[role="alertdialog"], [role="dialog"]').first();

async function openNotifications(page: Page) {
	if ((page.viewportSize()?.width ?? 0) < 768) {
		await page.getByRole("button", { name: "Відкрити меню" }).click();
		await page.getByRole("button", { name: "Відкрити сповіщення" }).click();
	} else {
		await page.getByRole("button", { name: /^Сповіщення/ }).click();
	}
}

const feedStrip = (page: Page) =>
	page.getByRole("region", { name: "Стрічка оновлень" });

const ALL_STATES: ReadonlyArray<State> = [
	{
		name: "home",
		section: "Головна",
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
		section: "Головна",
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
		section: "Стрічка",
		note: "/feed with banner promos, reviews and a comment",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/feed");
			await page.getByTestId("feed-list").waitFor();
		},
	},
	{
		name: "feed-empty",
		section: "Стрічка",
		note: "/feed with no items",
		run: async (page) => {
			await mockBackend(page, { feed: "empty" });
			await page.goto("/feed");
			await page.getByTestId("feed-empty-state").waitFor();
		},
	},
	{
		name: "feed-error",
		section: "Стрічка",
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
		name: "login",
		section: "Вхід і помилки",
		note: "Sign-in screen for a signed-out visitor",
		run: async (page) => {
			await mockBackend(page, { session: "guest" });
			await page.goto("/login");
			await page.getByRole("heading", { level: 1, name: "Вхід" }).waitFor();
		},
	},
	{
		name: "courses-error",
		section: "Вхід і помилки",
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
		section: "Мої оцінки",
		note: "Мої оцінки with rated and unrated courses across two years",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/my-ratings");
			await page.getByTestId("my-ratings-list").waitFor();
		},
	},
	{
		name: "my-ratings-empty",
		section: "Мої оцінки",
		note: "Мої оцінки for a student with no courses",
		run: async (page) => {
			await mockBackend(page, { grades: "empty" });
			await page.goto("/my-ratings");
			await page.getByTestId("my-ratings-empty-state").waitFor();
		},
	},
	{
		name: "course",
		section: "Курс",
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
		section: "Курс",
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
		section: "Курс",
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
		section: "Навігація",
		note: "Notifications open: two new, two earlier",
		run: async (page) => {
			await mockBackend(page, { notifications: "items" });
			await page.goto("/");
			await openNotifications(page);
			await page.getByText("Хтось вподобав ваш відгук").waitFor();
		},
	},
	{
		name: "rating-modal",
		section: "Оцінювання",
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
		section: "Оцінювання",
		note: "Attendee who can rate and has not yet: primary rate action",
		run: async (page) => {
			await mockBackend(page, { myCourses: "rateable" });
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByTestId("course-details-rate-button").waitFor();
		},
	},
	{
		name: "course-rate-soon",
		section: "Оцінювання",
		note: "Attendee before midterm: rating opens later, the reason is visible",
		run: async (page) => {
			await mockBackend(page, { myCourses: "not-yet" });
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByText("Оцінювання стане доступним").waitFor();
		},
	},
	{
		name: "course-rated",
		section: "Оцінювання",
		note: "Attendee who already rated: status and edit next to the scores",
		run: async (page) => {
			await mockBackend(page, { myCourses: "rated" });
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByText("Ваша оцінка").waitFor();
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
		section: "Оцінювання",
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
		section: "Коментарі",
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
		section: "Головна",
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
		section: "Коментарі",
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
		section: "Головна",
		note: "Home page with difficulty 1–3 and autumn filters applied",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/?diff=1-3&term=FALL");
			await page.getByText(COURSE.title).first().waitFor();
		},
	},
	{
		name: "explore",
		section: "Карта",
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
		section: "Карта",
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
	{
		name: "home-search",
		section: "Головна",
		note: "Course search narrowed to one title",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/");
			await page.getByText(COURSE.title).first().waitFor();
			await page.getByPlaceholder("Пошук курсів за назвою...").fill("Бази");
			await expect(page.getByTestId(testIds.courses.tableRow)).toHaveCount(1);
		},
	},
	{
		name: "home-no-results",
		section: "Головна",
		note: "Course search that matches nothing",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/");
			await page.getByText(COURSE.title).first().waitFor();
			await page
				.getByPlaceholder("Пошук курсів за назвою...")
				.fill("квантова хромодинаміка");
			await page
				.getByTestId(testIds.courses.emptyState)
				.scrollIntoViewIfNeeded();
		},
	},
	{
		name: "course-about-expanded",
		section: "Курс",
		note: "Course description opened with «Читати далі»",
		run: async (page) => {
			await mockBackend(page);
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByRole("button", { name: "Читати далі" }).first().click();
			await page.getByRole("button", { name: "Згорнути" }).first().waitFor();
		},
	},
	{
		name: "course-sort-menu",
		section: "Курс",
		note: "Review sort menu open",
		run: async (page) => {
			await mockBackend(page);
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByText("Лекції насичені").first().waitFor();
			await page
				.getByRole("combobox")
				.filter({ hasText: "Найпопулярніші" })
				.click();
			await page.getByRole("listbox").waitFor();
		},
	},
	{
		name: "course-vote-tooltip",
		section: "Курс",
		note: "A non-attendee hovering a vote sees why voting is off",
		run: async (page) => {
			await mockBackend(page);
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByText("Лекції насичені").first().waitFor();
			await page
				.getByRole("button", { name: /^За:/ })
				.first()
				.hover();
			await page.getByRole("tooltip").waitFor();
		},
	},
	{
		name: "course-rating-edit",
		section: "Оцінювання",
		note: "Own rating reopened for editing",
		run: async (page) => {
			await mockBackend(page, { myCourses: "rated" });
			await page.goto(`/courses/${COURSE.id}`);
			await page
				.getByTestId(testIds.courseDetails.editUserRatingButton)
				.click();
			await page.getByTestId(testIds.rating.modal).waitFor();
		},
	},
	{
		name: "course-rating-delete",
		section: "Оцінювання",
		note: "Deleting the own rating asks for confirmation",
		run: async (page) => {
			await mockBackend(page, { myCourses: "rated" });
			await page.goto(`/courses/${COURSE.id}`);
			await page.getByTestId(testIds.rating.deleteButton).click();
			await dialog(page).waitFor();
		},
	},
	{
		name: "my-ratings-all-open",
		section: "Мої оцінки",
		note: "Every semester expanded, including fully rated ones",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/my-ratings");
			await page.getByTestId(testIds.myRatings.list).waitFor();
			const closed = page.locator(
				`[data-testid="${testIds.myRatings.semesterTrigger}"][data-state="closed"]`,
			);
			while ((await closed.count()) > 0) await closed.first().click();
		},
	},
	{
		name: "my-ratings-edit",
		section: "Мої оцінки",
		note: "Editing a rating from Мої оцінки",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/my-ratings");
			await page.getByTestId(testIds.myRatings.editButton).first().click();
			await page.getByTestId(testIds.rating.modal).waitFor();
		},
	},
	{
		name: "my-ratings-delete",
		section: "Мої оцінки",
		note: "Deleting a rating from Мої оцінки asks for confirmation",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/my-ratings");
			await page.getByTestId(testIds.myRatings.deleteButton).first().click();
			await dialog(page).waitFor();
		},
	},
	{
		name: "notifications-empty",
		section: "Навігація",
		note: "Notifications open with nothing new",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/");
			await openNotifications(page);
			await page.getByText(/Сповіщень (ще )?немає|Немає сповіщень/).waitFor();
		},
	},
	{
		name: "mobile-menu",
		section: "Навігація",
		note: "Phone menu open",
		widths: ["phone"],
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/");
			await page.getByRole("button", { name: "Відкрити меню" }).click();
			await page.getByRole("button", { name: "Закрити меню" }).waitFor();
		},
	},
	{
		name: "login-failed",
		section: "Вхід і помилки",
		note: "Sign-in failed page",
		run: async (page) => {
			await mockBackend(page, { session: "guest" });
			await page.goto("/login/failed");
			await page.locator("h1").first().waitFor();
		},
	},
	{
		name: "connection-error",
		section: "Вхід і помилки",
		note: "Backend unreachable page",
		run: async (page) => {
			await mockBackend(page);
			await page.goto("/connection-error");
			await page.locator("h1").first().waitFor();
		},
	},
];
const STATES = ALL_STATES.filter((state) => !only || only.test(state.name));

const fileName = (state: string, width: string, theme: string) =>
	`${state}-${width}-${theme}.png`;

for (const width of WIDTHS) {
	for (const theme of THEMES) {
		for (const state of STATES) {
			if (state.widths && !state.widths.includes(width.name)) continue;
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
				await page.evaluate(() => document.fonts.ready);
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
	const pairedDir = join(out, "before");
	if (beforeDir) mkdirSync(pairedDir, { recursive: true });

	const views = WIDTHS.flatMap((width) =>
		THEMES.map((theme) => ({ id: `${width.name}-${theme}`, width, theme })),
	);
	const sections = [...new Set(STATES.map((state) => state.section))];
	const escape = (text: string) =>
		text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);
	const figure = (src: string, caption: string) =>
		`<figure><img src="${src}" alt="${escape(caption)}" loading="lazy"><figcaption>${caption}</figcaption></figure>`;

	// Byte-identical screenshots mean nothing moved; the renderer is deterministic.
	const status = (name: string): "same" | "changed" | "new" | "" => {
		if (!beforeDir) return "";
		const before = join(beforeDir, name);
		if (!existsSync(before)) return "new";
		const copy = join(pairedDir, name);
		if (resolve(before) !== resolve(copy)) copyFileSync(before, copy);
		return readFileSync(before).equals(readFileSync(join(out, name)))
			? "same"
			: "changed";
	};

	const tabs = views
		.map(
			(view, index) =>
				`<button role="tab" data-view="${view.id}" aria-selected="${index === 0}"><kbd>${index + 1}</kbd> ${view.width.name} ${view.width.width}px, ${view.theme}</button>`,
		)
		.join("");
	const nav = sections
		.map(
			(section) =>
				`<li><p>${section}</p><ul>${STATES.filter(
					(state) => state.section === section,
				)
					.map(
						(state) =>
							`<li><a href="#${state.name}" data-state="${state.name}">${state.name}</a></li>`,
					)
					.join("")}</ul></li>`,
		)
		.join("");
	const panels = views
		.map((view, index) => {
			const body = sections
				.map((section) => {
					const rows = STATES.filter(
						(state) =>
							state.section === section &&
							existsSync(
								join(out, fileName(state.name, view.width.name, view.theme)),
							),
					)
						.map((state) => {
							const name = fileName(state.name, view.width.name, view.theme);
							const mark = status(name);
							const row = beforeDir
								? (mark === "new"
										? "<figure><p class=missing>no before shot</p></figure>"
										: figure(`before/${name}`, "before")) +
									figure(name, "after")
								: figure(name, `${view.width.name}, ${view.theme}`);
							return `<section class="state" data-state="${state.name}" data-status="${mark}"><h3>${state.name}${mark ? ` <span class="mark ${mark}">${mark}</span>` : ""}</h3><p>${state.note}</p><div class="row${beforeDir ? " pair" : ""}">${row}</div></section>`;
						})
						.join("\n");
					return rows ? `<h2>${section}</h2>${rows}` : "";
				})
				.join("\n");
			return `<div role="tabpanel" data-view="${view.id}"${index === 0 ? "" : " hidden"}>${body}</div>`;
		})
		.join("\n");

	writeFileSync(
		join(out, "index.html"),
		`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>rate-ukma shots</title>
<style>
body{font:14px system-ui;margin:0;background:#f4f4f5;color:#1c1c1e}
header{position:sticky;top:0;z-index:2;background:#f4f4f5;border-bottom:1px solid #ddd;padding:12px 20px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
h1{font-size:16px;margin:0}.sub{color:#555}
[role=tablist]{display:flex;flex-wrap:wrap;gap:6px}
[role=tab]{border:1px solid #ccc;background:#fff;border-radius:999px;padding:6px 12px;font:inherit;cursor:pointer}
[role=tab][aria-selected=true]{background:#1c1c1e;color:#fff;border-color:#1c1c1e}
kbd{font:11px ui-monospace,monospace;opacity:.6}
input[type=search]{font:inherit;padding:6px 10px;border:1px solid #ccc;border-radius:8px;min-width:12rem}
.layout{display:grid;grid-template-columns:15rem minmax(0,1fr);gap:24px;padding:0 20px 40px}
nav{position:sticky;top:64px;align-self:start;max-height:calc(100vh - 80px);overflow:auto;padding-top:16px}
nav ul{list-style:none;margin:0;padding:0}nav>ul>li>p{margin:12px 0 4px;font-weight:600}
nav a{display:block;padding:2px 8px;border-radius:6px;color:inherit;text-decoration:none}nav a:hover{background:#e4e4e7}
nav a.current{background:#1c1c1e;color:#fff}nav a[data-status=changed]::after{content:" ●";color:#d97706}nav a[data-status=new]::after{content:" ●";color:#2563eb}
nav a.gone{display:none}
h2{margin:32px 0 8px;font-size:18px}h3{margin:0 0 2px;font-size:15px}.state{padding:12px 0;border-top:1px solid #e4e4e7;scroll-margin-top:80px}.state>p{margin:0 0 8px;color:#555}
.mark{font:600 11px system-ui;padding:2px 8px;border-radius:999px;vertical-align:middle}.mark.changed{background:#fef3c7;color:#92400e}.mark.new{background:#dbeafe;color:#1e40af}.mark.same{background:#e4e4e7;color:#555}
.row{display:flex;flex-direction:column;gap:16px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
figure{margin:0;min-width:0}img{max-width:100%;max-height:85vh;border:1px solid #ccc;background:#fff}figcaption{font-size:12px;color:#666;margin-top:4px}.missing{color:#888;padding:24px;border:1px dashed #ccc}
@media(max-width:900px){.layout{grid-template-columns:1fr}nav{display:none}.pair{grid-template-columns:1fr}}
</style>
<header>
<h1>rate-ukma shots</h1><span class="sub">${STATES.length} states${beforeDir ? ", before | after" : ""}. Keys: 1–${views.length} view, j/k state, / filter${beforeDir ? ", c changed only" : ""}.</span>
<div role="tablist" aria-label="View">${tabs}</div>
<input type="search" placeholder="Filter states" aria-label="Filter states">
${beforeDir ? '<label><input type="checkbox" id="changed"> changed only</label><span class="sub" id="counts"></span>' : ""}
</header>
<div class="layout"><nav aria-label="States"><ul>${nav}</ul></nav><main>${panels}</main></div>
<script>
const tabs=[...document.querySelectorAll('[role=tab]')];
const panels=[...document.querySelectorAll('[role=tabpanel]')];
const links=[...document.querySelectorAll('nav a')];
const filter=document.querySelector('input[type=search]');
const changedOnly=document.getElementById('changed');
const counts=document.getElementById('counts');
let view=0;
const panel=()=>panels[view];
const visible=()=>[...panel().querySelectorAll('.state')].filter(s=>!s.hidden);
function apply(){
  const q=filter.value.trim().toLowerCase();
  for(const s of panel().querySelectorAll('.state')){
    s.hidden=(q&&!s.dataset.state.includes(q))||(changedOnly?.checked&&s.dataset.status==='same');
  }
  for(const h of panel().querySelectorAll('h2')){
    let n=h.nextElementSibling,any=false;
    while(n&&n.tagName!=='H2'){if(n.classList.contains('state')&&!n.hidden)any=true;n=n.nextElementSibling}
    h.hidden=!any;
  }
  const byState=new Map([...panel().querySelectorAll('.state')].map(s=>[s.dataset.state,s]));
  for(const a of links){const s=byState.get(a.dataset.state);a.classList.toggle('gone',!s||s.hidden);a.dataset.status=s?.dataset.status??''}
  if(counts){const all=[...panel().querySelectorAll('.state')];counts.textContent=['changed','new','same'].map(k=>all.filter(s=>s.dataset.status===k).length+' '+k).join(', ')}
}
function pick(i){
  const current=document.querySelector('nav a.current')?.dataset.state;
  view=i;tabs.forEach((t,j)=>t.setAttribute('aria-selected',String(j===i)));panels.forEach((p,j)=>{p.hidden=j!==i});
  apply();syncHash(current);
}
function go(state,smooth){
  const s=panel().querySelector('.state[data-state="'+state+'"]');if(!s)return;
  s.scrollIntoView({behavior:smooth?'smooth':'auto'});mark(state);
}
function mark(state){links.forEach(a=>a.classList.toggle('current',a.dataset.state===state));history.replaceState(null,'','#'+tabs[view].dataset.view+'/'+(state??''))}
function syncHash(state){if(state)go(state);else history.replaceState(null,'','#'+tabs[view].dataset.view+'/')}
function step(d){
  const list=visible();const top=list.findIndex(s=>s.getBoundingClientRect().top>90);
  const at=top<0?list.length:top;const next=list[Math.max(0,Math.min(list.length-1,d>0?at:at-2))];
  if(next)go(next.dataset.state,true);
}
tabs.forEach((t,i)=>t.addEventListener('click',()=>pick(i)));
links.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();go(a.dataset.state,true)}));
filter.addEventListener('input',apply);changedOnly?.addEventListener('change',apply);
addEventListener('keydown',e=>{
  if(e.target===filter){if(e.key==='Escape')filter.blur();return}
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const n=Number(e.key);if(n>=1&&n<=tabs.length){pick(n-1);return}
  if(e.key==='j'||e.key==='ArrowDown'&&e.shiftKey){e.preventDefault();step(1)}
  if(e.key==='k'||e.key==='ArrowUp'&&e.shiftKey){e.preventDefault();step(-1)}
  if(e.key==='/'){e.preventDefault();filter.focus()}
  if(e.key==='c'&&changedOnly){changedOnly.checked=!changedOnly.checked;apply()}
});
const io=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting&&!e.target.closest('[hidden]'))links.forEach(a=>a.classList.toggle('current',a.dataset.state===e.target.dataset.state))},{rootMargin:'-80px 0px -70% 0px'});
document.querySelectorAll('.state').forEach(s=>io.observe(s));
const [hv,hs]=location.hash.slice(1).split('/');const start=tabs.findIndex(t=>t.dataset.view===hv);
pick(start>=0?start:0);if(hs)go(decodeURIComponent(hs));
</script>`,
	);
});
