import type { Page, Route } from "@playwright/test";

import {
	ANALYTICS,
	COMMENT_REPLIES,
	COURSE_DETAIL,
	COURSE_INSTRUCTORS,
	COURSE_OFFERINGS,
	COURSE_OFFERINGS_MANY,
	COURSE_RATINGS,
	COURSES,
	EMPTY_COMMENT_LIST,
	FEED_ITEMS,
	FILTER_OPTIONS,
	myCourses as myCoursesFor,
	type MyCourseState,
	MY_GRADES,
	LONG_COURSE_TITLE,
	MANY_SPECIALITIES,
	MY_GRADES_MANY,
	NOTIFICATIONS,
	RATING_COMMENTS,
	SESSION,
} from "./data";

export interface MockOptions {
	readonly feed?: "items" | "empty" | "error";
	readonly courses?: "items" | "error";
	readonly grades?: "items" | "many" | "empty";
	readonly myCourses?: "none" | MyCourseState;
	readonly comments?: "empty" | "thread";
	readonly reviews?: "items" | "empty";
	readonly notifications?: "none" | "items";
	readonly session?: "student" | "guest";
	/** `many` gives the first course twenty specialities, like a general course. */
	readonly specialities?: "one" | "many";
	/** `long` gives the course a САЗ-length title that wraps in headers and modals. */
	readonly title?: "short" | "long";
	/** `none` is a course nobody has named a teacher on yet. */
	readonly courseInstructors?: "named" | "none";
	/** Only session, flags and counters answer; content requests never do, so pages hold their skeletons. */
	readonly loading?: boolean;
	readonly ratingSuggestions?: "items" | "empty" | "error";
	readonly saveRating?: "success" | "error";
	/** `fe_rate_flow`: `pending` never answers the flags request, so flags stay unresolved. */
	readonly rateFlow?: "on" | "off" | "pending";
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
		reviews = "items",
		notifications = "none",
		session = "student",
		specialities = "one",
		title = "short",
		courseInstructors = "named",
		loading = false,
		ratingSuggestions = "empty",
		saveRating = "success",
		rateFlow = "on",
	}: MockOptions = {},
): Promise<void> {
	const saved = new Set<string>();
	const savedRatings = new Map<
		string,
		{
			id: string;
			difficulty: number;
			usefulness: number;
			comment: string;
			is_anonymous: boolean;
			instructors: [];
		}
	>();
	const suggestions = [
		{
			course_id: "c-db",
			course_offering_id: "offering-c-db",
			course_title: "Бази даних",
			semester: { year: 2026, season: "SPRING" },
			ratings_count: 0,
		},
		{
			course_id: "c-ml",
			course_offering_id: "offering-c-ml",
			course_title: "Машинне навчання",
			semester: { year: 2026, season: "SPRING" },
			ratings_count: 2,
		},
		{
			course_id: "c-discrete",
			course_offering_id: "offering-c-discrete",
			course_title: "Дискретна математика",
			semester: { year: 2026, season: "SPRING" },
			ratings_count: 14,
		},
		{
			course_id: "c-arch",
			course_offering_id: "offering-c-arch",
			course_title: "Архітектура комп’ютерів",
			semester: { year: 2025, season: "FALL" },
			ratings_count: 0,
		},
	];
	const many = specialities === "many";
	const courseItems = many
		? COURSES.map((course, index) =>
				index === 0 ? { ...course, specialities: MANY_SPECIALITIES } : course,
			)
		: COURSES;
	const suggestedCourseItems =
		ratingSuggestions === "items"
			? courseItems.map((course) => {
					const item = suggestions.find((item) => item.course_id === course.id);
					return item
						? {
								...course,
								title: item.course_title,
								ratings_count: item.ratings_count,
							}
						: course;
				})
			: courseItems;
	const courseDetail = {
		...COURSE_DETAIL,
		...(many ? { specialities: MANY_SPECIALITIES } : {}),
		...(title === "long" ? { title: LONG_COURSE_TITLE } : {}),
	};
	const visibleCourseList = { ...courseList, items: suggestedCourseItems };
	const handlers: ReadonlyArray<
		readonly [RegExp, (path: string, url: URL) => unknown]
	> = [
		[
			/^\/auth\/session\/$/,
			() =>
				session === "guest"
					? { is_authenticated: false, user: null, expires_at: null }
					: SESSION,
		],
		[
			/^\/students\/me\/rating-suggestions\/$/,
			(_path, url) =>
				ratingSuggestions === "items"
					? suggestions
							.filter(
								(item) =>
									!saved.has(item.course_id) &&
									item.course_id !== url.searchParams.get("exclude_course"),
							)
							.slice(0, 3)
					: [],
		],
		[/^\/auth\/csrf\/$/, () => ({ csrfToken: "shots" })],
		[
			/^\/flags\/$/,
			() => ({
				flags: {
					fe_feed: true,
					fe_faculty_colors: true,
					fe_rate_flow: rateFlow === "on",
				},
			}),
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
		[
			/^\/courses\/$/,
			(_path, url) => {
				const query = url.searchParams.get("name")?.toLowerCase();
				if (!query) return visibleCourseList;
				const items = suggestedCourseItems.filter((course) =>
					course.title?.toLowerCase().includes(query),
				);
				return { ...visibleCourseList, items, total: items.length };
			},
		],
		[
			/^\/courses\/[^/]+\/instructors\/$/,
			() =>
				courseInstructors === "named" ? COURSE_INSTRUCTORS : { items: [] },
		],
		[
			/^\/courses\/[^/]+\/offerings\/$/,
			() => (many ? COURSE_OFFERINGS_MANY : COURSE_OFFERINGS),
		],
		[
			/^\/courses\/[^/]+\/ratings\/$/,
			(path) => {
				const courseId = path.split("/")[2];
				const suggestion =
					ratingSuggestions === "items"
						? suggestions.find((item) => item.course_id === courseId)
						: undefined;
				const rating = savedRatings.get(courseId);
				const count =
					reviews === "empty"
						? 0
						: (suggestion?.ratings_count ?? COURSE_RATINGS.total);
				return {
					...COURSE_RATINGS,
					total: count + (rating ? 1 : 0),
					items: {
						ratings:
							count === 0 ? [] : COURSE_RATINGS.items.ratings.slice(0, count),
						user_ratings: rating
							? [
									{
										...rating,
										student_id: "student-me",
										course: courseId,
										course_offering_year: 2026,
										course_offering_term: "SPRING",
									},
								]
							: null,
					},
				};
			},
		],
		[
			/^\/courses\/[^/]+\/$/,
			(path) => {
				const courseId = path.split("/")[2];
				const suggested =
					ratingSuggestions === "items"
						? suggestedCourseItems.find((item) => item.id === courseId)
						: undefined;
				const detail = {
					...courseDetail,
					...(suggested
						? {
								...suggested,
								description: `Курс «${suggested.title}» для студентів бакалаврату.`,
							}
						: {}),
				};
				const rating = savedRatings.get(courseId);
				if (rating) {
					const count = detail.ratings_count ?? 0;
					return {
						...detail,
						ratings_count: count + 1,
						avg_difficulty:
							((detail.avg_difficulty ?? 0) * count + rating.difficulty) /
							(count + 1),
						avg_usefulness:
							((detail.avg_usefulness ?? 0) * count + rating.usefulness) /
							(count + 1),
					};
				}
				return reviews === "empty"
					? {
							...detail,
							avg_difficulty: null,
							avg_usefulness: null,
							ratings_count: 0,
						}
					: detail;
			},
		],
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
				comments === "thread" && path.endsWith("/comments/comment-c1/replies/")
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
			() => {
				const items =
					ratingSuggestions === "items"
						? MY_GRADES.map((course) => {
								const item = suggestions.find(
									(item) => item.course_id === course.course_id,
								);
								return item
									? {
											...course,
											course_title: item.course_title,
											semester: item.semester,
											rated: saved.has(item.course_id)
												? {
														id: `saved-${item.course_id}`,
														difficulty: 3,
														usefulness: 4,
														comment: "",
														is_anonymous: true,
														instructors: [],
													}
												: null,
										}
									: course;
							})
						: MY_GRADES;
				return { items, many: MY_GRADES_MANY, empty: [] }[grades];
			},
		],
		[
			/^\/students\/me\/courses\/$/,
			() => [
				...(myCourses === "none"
					? []
					: myCoursesFor(myCourses).map((course) => ({
							...course,
							offerings: course.offerings.map((offering) => ({
								...offering,
								rated: savedRatings.get(course.id!) ?? offering.rated,
							})),
						}))),
				...(ratingSuggestions === "items"
					? suggestions.map((item) => ({
							id: item.course_id,
							offerings: [
								{
									id: item.course_offering_id,
									course_id: item.course_id,
									year: item.semester.year,
									season: item.semester.season,
									can_rate: true,
									rated: savedRatings.get(item.course_id) ?? null,
								},
							],
						}))
					: []),
			],
		],
	];
	const failing: ReadonlyArray<RegExp> = [
		...(ratingSuggestions === "error"
			? [/^\/students\/me\/rating-suggestions\/$/]
			: []),
		...(feed === "error" ? [/^\/feed\/$/] : []),
		...(courses === "error" ? [/^\/courses\/$/, /^\/analytics\/$/] : []),
	];

	const shell: ReadonlyArray<RegExp> = [
		/^\/auth\//,
		/^\/flags\/$/,
		/^\/promo-banner\/$/,
		/^\/notifications\/unread-count\/$/,
	];

	await page.route("**/api/v1/**", async (route: Route) => {
		const url = new URL(route.request().url());
		const path = url.pathname.replace(/^\/api\/v1/, "");
		if (rateFlow === "pending" && path === "/flags/") {
			await new Promise(() => {});
		}
		if (
			route.request().method() === "POST" &&
			/^\/courses\/[^/]+\/ratings\/$/.test(path)
		) {
			const payload = route.request().postDataJSON();
			if (saveRating === "error") {
				await route.fulfill({
					status: 500,
					json: { detail: "shots: forced save failure" },
				});
				return;
			}
			const courseId = path.split("/")[2];
			saved.add(courseId);
			savedRatings.set(courseId, {
				id: `saved-${courseId}`,
				difficulty: payload.difficulty,
				usefulness: payload.usefulness,
				comment: payload.comment ?? "",
				is_anonymous: payload.is_anonymous,
				instructors: [],
			});
			await route.fulfill({
				status: 201,
				json: { id: "new-rating", ...payload },
			});
			return;
		}
		// Left unanswered: the page stays in its loading state for the shot.
		if (loading && !shell.some((pattern) => pattern.test(path))) return;
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
		await route.fulfill({ json: handler[1](path, url) });
	});
}
