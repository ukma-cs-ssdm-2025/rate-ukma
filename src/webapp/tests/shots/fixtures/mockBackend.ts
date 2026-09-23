import type { Page, Route } from "@playwright/test";

import {
	ANALYTICS,
	COMMENT_REPLIES,
	COURSE_DETAIL,
	COURSE_OFFERINGS,
	COURSE_RATINGS,
	COURSES,
	EMPTY_COMMENT_LIST,
	FEED_ITEMS,
	FILTER_OPTIONS,
	MY_COURSES,
	MY_GRADES,
	NOTIFICATIONS,
	RATING_COMMENTS,
	SESSION,
} from "./data";

export interface MockOptions {
	readonly feed?: "items" | "empty" | "error";
	readonly courses?: "items" | "error";
	readonly grades?: "items" | "empty";
	readonly myCourses?: "none" | "rateable";
	readonly comments?: "empty" | "thread";
	readonly notifications?: "none" | "items";
}

const courseList = {
	items: COURSES,
	filters: { page: 1, page_size: 20 },
	page: 1,
	page_size: 20,
	total: COURSES.length,
	total_pages: 1,
	next_page: null,
	previous_page: null,
};

/**
 * Answers every `/api/v1/` request from invented fixtures. A request with no
 * handler is aborted and reported, so a new endpoint shows up as a gap
 * instead of a silently half-rendered screenshot.
 */
export async function mockBackend(
	page: Page,
	{
		feed = "items",
		courses = "items",
		grades = "items",
		myCourses = "none",
		comments = "empty",
		notifications = "none",
	}: MockOptions = {},
): Promise<void> {
	const handlers: ReadonlyArray<readonly [RegExp, (path: string) => unknown]> =
		[
			[/^\/auth\/session\/$/, () => SESSION],
			[/^\/auth\/csrf\/$/, () => ({ csrfToken: "shots" })],
			[
				/^\/flags\/$/,
				() => ({ flags: { fe_feed: true, fe_faculty_colors: true } }),
			],
			[/^\/promo-banner\/$/, () => ({ banner: null })],
			[
				/^\/notifications\/unread-count\/$/,
				() => ({
					count:
						notifications === "items"
							? NOTIFICATIONS.filter((item) => item.is_unread).length
							: 0,
				}),
			],
			[
				/^\/notifications\/$/,
				() => (notifications === "items" ? NOTIFICATIONS : []),
			],
			[
				/^\/feed\/$/,
				() => ({
					items: feed === "empty" ? [] : FEED_ITEMS,
					next_cursor: null,
				}),
			],
			[/^\/courses\/filter-options\/$/, () => FILTER_OPTIONS],
			[/^\/courses\/$/, () => courseList],
			[/^\/courses\/[^/]+\/offerings\/$/, () => COURSE_OFFERINGS],
			[/^\/courses\/[^/]+\/ratings\/$/, () => COURSE_RATINGS],
			[/^\/courses\/[^/]+\/$/, () => COURSE_DETAIL],
			[
				/^\/ratings\/[^/]+\/comments\/$/,
				(path) =>
					comments === "thread" && path.endsWith("/ratings/rating-0/comments/")
						? RATING_COMMENTS
						: EMPTY_COMMENT_LIST,
			],
			[
				/^\/comments\/[^/]+\/replies\/$/,
				(path) =>
					comments === "thread" &&
					path.endsWith("/comments/comment-c1/replies/")
						? COMMENT_REPLIES
						: EMPTY_COMMENT_LIST,
			],
			[/^\/analytics\/$/, () => ANALYTICS],
			[/^\/analytics\/[^/]+\/$/, () => ANALYTICS[0]],
			[
				/^\/instructors\/$/,
				() => ({
					items: [],
					page: 1,
					page_size: 20,
					total: 0,
					total_pages: 0,
					next_page: null,
					previous_page: null,
				}),
			],
			[
				/^\/students\/me\/grades\/$/,
				() => (grades === "empty" ? [] : MY_GRADES),
			],
			[
				/^\/students\/me\/courses\/$/,
				() => (myCourses === "rateable" ? MY_COURSES : []),
			],
		];
	const failing: ReadonlyArray<RegExp> = [
		...(feed === "error" ? [/^\/feed\/$/] : []),
		...(courses === "error" ? [/^\/courses\/$/, /^\/analytics\/$/] : []),
	];

	await page.route("**/api/v1/**", async (route: Route) => {
		const path = new URL(route.request().url()).pathname.replace(
			/^\/api\/v1/,
			"",
		);
		if (failing.some((pattern) => pattern.test(path))) {
			await route.fulfill({
				status: 500,
				json: { detail: "shots: forced failure" },
			});
			return;
		}
		const handler = handlers.find(([pattern]) => pattern.test(path));
		if (!handler) {
			console.warn(`[shots] unmocked ${route.request().method()} ${path}`);
			await route.abort();
			return;
		}
		await route.fulfill({ json: handler[1](path) });
	});
}
