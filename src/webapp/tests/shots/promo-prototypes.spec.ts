import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { mockBackend } from "./fixtures/mockBackend";
import { COURSE } from "./fixtures/data";
import { testIds } from "../../src/lib/test-ids";

// Prototype screenshots: `SHOT_DIR=... pnpm exec playwright test -c playwright.shots.config.ts promo-prototypes`.
const out = resolve(process.env.SHOT_DIR ?? "shots/promo-prototypes");

const WIDTHS = [
	{ name: "desktop", width: 1440, height: 900 },
	{ name: "phone", width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;

async function score(page: Page, difficulty: number, usefulness: number) {
	await page
		.getByTestId(testIds.rating.difficultySlider)
		.getByRole("radio", { name: `${difficulty} з 5` })
		.click();
	await page
		.getByTestId(testIds.rating.usefulnessSlider)
		.getByRole("radio", { name: `${usefulness} з 5` })
		.click();
}

const thanks = (page: Page) => page.getByTestId("rating-saved-modal");

// A finished autumn: four courses rated, «Бази даних» left until the test saves it.
function storyGrades(dbRated: boolean) {
	const semester = { year: 2025, season: "FALL" };
	const rated = (id: string, difficulty: number, usefulness: number) => ({
		id,
		difficulty,
		usefulness,
		comment: "",
		instructor: null,
		instructors: [],
		is_anonymous: true,
	});
	const course = (
		id: string,
		title: string,
		rating: ReturnType<typeof rated> | null,
	) => ({
		course_id: id,
		course_title: title,
		course_code: `9${id}`,
		course_offering_id: `offering-${id}`,
		faculty_name: "Факультет інформатики",
		semester,
		rated: rating,
		can_rate: true,
	});
	return [
		course("c-db", "Бази даних", dbRated ? rated("r-db", 4, 5) : null),
		course("c-ml", "Машинне навчання", rated("r-ml", 5, 4)),
		course("c-os", "Операційні системи", rated("r-os", 4, 4)),
		course("c-eng", "Англійська мова", rated("r-eng", 2, 3)),
		course("c-phil", "Філософія", rated("r-phil", 2, 2)),
	];
}

for (const width of WIDTHS) {
	for (const theme of THEMES) {
		const name = (shot: string) => `${shot}-${width.name}-${theme}.png`;
		const shot = async (page: Page, file: string) => {
			mkdirSync(out, { recursive: true });
			await page.screenshot({ path: resolve(out, name(file)) });
		};

		test.describe(`${width.name} ${theme}`, () => {
			test.beforeEach(async ({ page }) => {
				await page.setViewportSize({
					width: width.width,
					height: width.height,
				});
				await page.addInitScript((value) => {
					localStorage.setItem("rate-ukma-theme", value);
				}, theme);
			});

			test("faculty progress on home", async ({ page }) => {
				await mockBackend(page);
				await page.goto("/");
				const card = page.getByRole("region", {
					name: "Оцінювання семестру за факультетами",
				});
				await expect(card).toBeVisible();
				await page.getByText(COURSE.title).first().waitFor();
				await shot(page, "home-faculties");
			});

			test("quick tags in the rating form", async ({ page }) => {
				await mockBackend(page, { myCourses: "rateable" });
				await page.goto(`/courses/${COURSE.id}`);
				await page.getByTestId("course-details-rate-button").click();
				const modal = page.getByTestId(testIds.rating.modal);
				await score(page, 4, 5);
				await modal.getByRole("button", { name: "Цікаві лекції" }).click();
				await modal.getByRole("button", { name: "Багато домашки" }).click();
				await expect(
					modal.getByRole("button", { name: "Цікаві лекції" }),
				).toHaveAttribute("aria-pressed", "true");
				await shot(page, "form-tags");
			});

			test("thanks: scores next to others", async ({ page }) => {
				await mockBackend(page, { ratingSuggestions: "items" });
				await page.goto("/my-ratings");
				await page
					.getByRole("button", { name: "Оцінити «Бази даних»", exact: true })
					.click();
				await score(page, 4, 5);
				await page.getByTestId(testIds.rating.submitButton).click();
				await expect(
					thanks(page).getByRole("region", {
						name: "Ваша оцінка поруч з іншими",
					}),
				).toBeVisible();
				await shot(page, "thanks-compare");
			});

			test("thanks: semester done, story card", async ({ page }) => {
				await mockBackend(page, { ratingSuggestions: "empty" });
				let dbRated = false;
				page.on("request", (request) => {
					if (
						request.method() === "POST" &&
						request.url().endsWith("/ratings/")
					)
						dbRated = true;
				});
				await page.route("**/api/v1/students/me/grades/", (route) =>
					route.fulfill({ json: storyGrades(dbRated) }),
				);
				await page.goto("/my-ratings");
				await page
					.getByRole("button", { name: /^Оцінити/ })
					.first()
					.click();
				await score(page, 4, 5);
				await page.getByTestId(testIds.rating.submitButton).click();
				await expect(
					thanks(page).getByText("Осінь 2025 оцінено"),
				).toBeVisible();
				await shot(page, "thanks-story");

				await thanks(page)
					.getByRole("button", { name: "Переглянути картку" })
					.click();
				await expect(thanks(page).getByTestId("semester-story")).toBeVisible();
				await shot(page, "story-card");
			});
		});
	}
}
