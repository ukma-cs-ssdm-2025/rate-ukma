import { expect, test } from "@playwright/test";

import { testIds } from "../../src/lib/test-ids";
import { COURSE, COURSE_RATINGS, FEED_ITEMS } from "./fixtures/data";
import { mockBackend } from "./fixtures/mockBackend";

const LONG_COMMENT = "Дуже довгий відгук про курс. ".repeat(30);
const SHORT_COMMENT = "Короткий відгук.";

const ratingsWith = (comments: readonly string[]) => ({
	...COURSE_RATINGS,
	items: {
		...COURSE_RATINGS.items,
		ratings: comments.map((comment, index) => ({
			...COURSE_RATINGS.items.ratings[index],
			id: `layout-rating-${index}`,
			comment,
		})),
	},
	total: comments.length,
});

test("the feed strip pages sideways when its items overflow", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockBackend(page);
	await page.goto("/");

	const strip = page.getByRole("region", { name: "Стрічка оновлень" });
	await expect(strip.getByText("Студентський хакатон")).toBeVisible();

	const previous = strip.getByRole("button", { name: "Попередні" });
	const next = strip.getByRole("button", { name: "Наступні" });
	await expect(next).toBeEnabled();
	await expect(previous).toBeDisabled();

	const scrollId = await next.getAttribute("aria-controls");
	if (!scrollId) {
		throw new Error("The feed paging control has no aria-controls target");
	}
	const scroller = page.locator(`[id="${scrollId}"]`);
	expect(await scroller.evaluate((element) => element.scrollLeft)).toBe(0);

	await next.click();
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollLeft))
		.toBeGreaterThan(0);
	await expect(previous).toBeEnabled();
});

test("the feed strip disables paging when everything fits", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockBackend(page);
	await page.route("**/api/v1/feed/**", (route) =>
		route.fulfill({
			json: { items: FEED_ITEMS.slice(0, 2), next_cursor: null },
		}),
	);
	await page.goto("/");

	const strip = page.getByRole("region", { name: "Стрічка оновлень" });
	await expect(strip.getByText("Студентський хакатон")).toBeVisible();
	await expect(strip.getByRole("button", { name: "Попередні" })).toBeDisabled();
	await expect(strip.getByRole("button", { name: "Наступні" })).toBeDisabled();
});

test("a long rating comment is clamped and a short one is not", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockBackend(page);
	await page.route("**/api/v1/courses/*/ratings/**", (route) =>
		route.fulfill({ json: ratingsWith([LONG_COMMENT, SHORT_COMMENT]) }),
	);
	await page.goto(`/courses/${COURSE.id}`);

	const cards = page.getByTestId(testIds.courseDetails.reviewCard);
	const longCard = cards.filter({ hasText: LONG_COMMENT.slice(0, 40) });
	await expect(longCard).toBeVisible();

	const text = longCard.getByText(LONG_COMMENT.slice(0, 40));
	const overflow = () =>
		text.evaluate((element) => element.scrollHeight - element.clientHeight);
	const collapsedHeight = await text.evaluate(
		(element) => element.clientHeight,
	);
	expect(await overflow()).toBeGreaterThan(1);

	const showMore = longCard.getByRole("button", { name: "Читати далі" });
	await expect(showMore).toHaveAttribute("aria-expanded", "false");
	await showMore.click();
	await expect(
		longCard.getByRole("button", { name: "Згорнути" }),
	).toHaveAttribute("aria-expanded", "true");
	await expect.poll(overflow).toBeLessThanOrEqual(1);
	expect(
		await text.evaluate((element) => element.clientHeight),
	).toBeGreaterThan(collapsedHeight);

	const shortCard = cards.filter({ hasText: SHORT_COMMENT });
	await expect(shortCard).toBeVisible();
	await expect(
		shortCard.getByRole("button", { name: /Читати далі|Згорнути/ }),
	).toHaveCount(0);
});
