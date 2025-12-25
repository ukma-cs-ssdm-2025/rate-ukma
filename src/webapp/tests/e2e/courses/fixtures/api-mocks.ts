import type { Page } from "@playwright/test";

// Matches `/api/v1/courses` and `/api/v1/courses/` with optional query string.
// Does NOT match `/api/v1/courses/<something>` like `/api/v1/courses/filter-options/`.
const COURSES_LIST_URL_RE = /\/api\/v1\/courses\/?(?:\?.*)?$/;

export async function mockCoursesListError(
	page: Page,
	statusCode = 500,
): Promise<void> {
	await page.route(COURSES_LIST_URL_RE, async (route) => {
		await route.fulfill({
			status: statusCode,
			contentType: "application/json",
			body: JSON.stringify({ detail: "Mocked error" }),
		});
	});
}

export async function mockCoursesListEmpty(page: Page): Promise<void> {
	await page.route(COURSES_LIST_URL_RE, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				items: [],
				total: 0,
				page: 1,
				page_size: 20,
				total_pages: 0,
			}),
		});
	});
}

export async function mockCoursesListTimeout(
	page: Page,
	delayMs = 60_000,
): Promise<void> {
	await page.route(COURSES_LIST_URL_RE, async (route) => {
		await new Promise((resolve) => setTimeout(resolve, delayMs));
		await route.abort();
	});
}

export async function restoreCoursesListApi(page: Page): Promise<void> {
	await page.unroute(COURSES_LIST_URL_RE);
}
