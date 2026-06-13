import {
	expect,
	type Locator,
	type Page,
	type Response as PlaywrightResponse,
	type Route,
	type TestInfo,
	test,
} from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { MyRatingsPage } from "./my-ratings.page";
import { CourseDetailsPage } from "../courses/course-details.page";
import { createTestRatingData } from "../framework/test-config";
import { CommentsSection } from "../shared/comments-section.component";
import { RatingModal } from "../shared/rating-modal.component";

const ANONYMOUS_REVIEW_NAME = "Анонімний відгук";
const COMMENTS_LIST_ROUTE = "**/api/v1/ratings/**/comments/**";
const NON_OWNER_USER_ID = 1_000_001;

interface SeededRatingContext {
	readonly page: Page;
	readonly coursePage: CourseDetailsPage;
	readonly comments: CommentsSection;
	readonly reviewCard: Locator;
	readonly ratingComment: string;
	readonly ratingId: string;
	readonly courseId: string;
	readonly apiOrigin: string;
}

interface CommentListPayload {
	items?: CommentPayload[];
	[key: string]: unknown;
}

interface CommentPayload {
	content?: string | null;
	can_manage?: boolean;
	user_id?: number | null;
	user_name?: string | null;
	user_avatar_url?: string | null;
	is_anonymous?: boolean;
	[key: string]: unknown;
}

test.describe("Rating comments workflow", () => {
	test.describe.configure({ mode: "serial" });

	test("posts a top-level comment under a rating", async ({ page }) => {
		await withSeededRating(page, test.info(), async ({ comments }) => {
			const comment = uniqueText(test.info(), "comment");

			await comments.createComment(comment);
			await comments.expectCommentVisible(comment);
		});
	});

	test("posts and expands a nested reply", async ({ page }) => {
		await withSeededRating(page, test.info(), async ({ comments }) => {
			const parentComment = uniqueText(test.info(), "parent");
			const reply = uniqueText(test.info(), "reply");

			await comments.createComment(parentComment);
			await comments.replyToComment(parentComment, reply);
			await comments.expandReplies(parentComment);
			await comments.expectCommentVisible(reply, "last");
		});
	});

	test("edits an own comment", async ({ page }) => {
		await withSeededRating(page, test.info(), async ({ comments }) => {
			const originalComment = uniqueText(test.info(), "edit-original");
			const updatedComment = uniqueText(test.info(), "edit-updated");

			await comments.createComment(originalComment);
			await comments.editComment(originalComment, updatedComment);

			await comments.expectCommentHidden(originalComment);
			await comments.expectCommentVisible(updatedComment);
		});
	});

	test("deletes a comment through the confirmation dialog", async ({
		page,
	}) => {
		await withSeededRating(page, test.info(), async ({ comments }) => {
			const comment = uniqueText(test.info(), "delete");

			await comments.createComment(comment);
			await comments.requestDeleteComment(comment);
			await comments.cancelDelete();
			await comments.expectCommentVisible(comment);

			await comments.deleteComment(comment);
		});
	});

	test("renders anonymous comments with the anonymous author", async ({
		page,
	}) => {
		await withSeededRating(page, test.info(), async ({ comments }) => {
			const comment = uniqueText(test.info(), "anonymous");

			await comments.createComment(comment, { anonymous: true });

			const commentItem = await comments.expectCommentVisible(comment);
			await expect(commentItem).toContainText(ANONYMOUS_REVIEW_NAME);
		});
	});

	test("hides edit and delete actions for non-owner comments", async ({
		page,
	}) => {
		await withSeededRating(
			page,
			test.info(),
			async ({ comments, coursePage, ratingComment }) => {
				const comment = uniqueText(test.info(), "non-owner");

				await comments.createComment(comment);
				const stopMockingCommentOwner = await mockCommentAsNonOwner(
					page,
					comment,
				);
				try {
					await page.reload();
					await expect(
						page.getByTestId(testIds.courseDetails.title),
					).toBeVisible();

					const reloadedCard =
						await coursePage.findReviewCardByText(ratingComment);
					const reloadedComments = new CommentsSection(page, reloadedCard);

					await reloadedComments.expand();
					await reloadedComments.expectManagementActionsHidden(comment);
				} finally {
					await stopMockingCommentOwner();
				}
			},
		);
	});
});

async function withSeededRating(
	page: Page,
	testInfo: TestInfo,
	run: (context: SeededRatingContext) => Promise<void>,
): Promise<void> {
	let context: SeededRatingContext | undefined;
	let mainError: unknown;

	try {
		context = await seedRating(page, testInfo);
		await run(context);
	} catch (error) {
		mainError = error;
	}

	if (context) {
		try {
			await cleanupSeededRating(context);
		} catch (cleanupError) {
			if (!mainError) {
				throw cleanupError;
			}
			console.warn(
				"Failed to cleanup rating created by comments e2e test",
				cleanupError,
			);
		}
	}

	if (mainError) {
		throw mainError;
	}
}

async function seedRating(
	page: Page,
	testInfo: TestInfo,
): Promise<SeededRatingContext> {
	const myRatingsPage = new MyRatingsPage(page);
	const coursePage = new CourseDetailsPage(page);
	const ratingModal = new RatingModal(page);

	await myRatingsPage.goto();
	await myRatingsPage.openFirstCourseToRate();
	await expect(page.getByTestId(testIds.courseDetails.title)).toBeVisible();

	const courseId = getCourseIdFromUrl(page);
	const ratingComment = uniqueText(testInfo, "rating");
	const testData = createTestRatingData({ comment: ratingComment });

	await coursePage.clickRateButton();
	await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();
	await ratingModal.fillRatingForm(testData);

	const [ratingResponse] = await Promise.all([
		page.waitForResponse(isRatingCreateResponse),
		ratingModal.submitRating(),
	]);

	if (!ratingResponse.ok()) {
		throw new Error(
			`Rating create failed with HTTP ${ratingResponse.status()}`,
		);
	}

	await ratingModal.waitForHidden();

	const ratingPayload = (await ratingResponse.json()) as { id?: string };
	if (!ratingPayload.id) {
		throw new Error("Rating create response did not include an id");
	}

	const reviewCard = await coursePage.findReviewCardByText(ratingComment);

	return {
		page,
		coursePage,
		comments: new CommentsSection(page, reviewCard),
		reviewCard,
		ratingComment,
		ratingId: ratingPayload.id,
		courseId,
		apiOrigin: new URL(ratingResponse.url()).origin,
	};
}

async function cleanupSeededRating({
	page,
	coursePage,
	reviewCard,
	ratingId,
	courseId,
	apiOrigin,
}: SeededRatingContext): Promise<void> {
	try {
		await coursePage.deleteUserRating();
		await expect(reviewCard).toBeHidden();
	} catch (uiCleanupError) {
		try {
			await deleteRatingViaApi(page, apiOrigin, courseId, ratingId);
		} catch (apiCleanupError) {
			throw new AggregateError(
				[uiCleanupError, apiCleanupError],
				"Failed to cleanup seeded rating through UI and API",
			);
		}
	}
}

async function deleteRatingViaApi(
	page: Page,
	apiOrigin: string,
	courseId: string,
	ratingId: string,
): Promise<void> {
	const response = await page.request.delete(
		`${apiOrigin}/api/v1/courses/${courseId}/ratings/${ratingId}/`,
		{ headers: await getUnsafeRequestHeaders(page, apiOrigin) },
	);

	if (!response.ok() && response.status() !== 404) {
		throw new Error(`Rating cleanup failed with HTTP ${response.status()}`);
	}
}

async function getUnsafeRequestHeaders(
	page: Page,
	apiOrigin: string,
): Promise<Record<string, string>> {
	let csrfToken = await getCsrfToken(page, apiOrigin);

	if (!csrfToken) {
		const response = await page.request.get(`${apiOrigin}/api/v1/auth/csrf/`);
		if (!response.ok()) {
			throw new Error(
				`CSRF token request failed with HTTP ${response.status()}`,
			);
		}
		csrfToken = await getCsrfToken(page, apiOrigin);
	}

	return {
		"X-Requested-With": "XMLHttpRequest",
		...(csrfToken ? { "X-CSRFToken": decodeURIComponent(csrfToken) } : {}),
	};
}

async function getCsrfToken(
	page: Page,
	apiOrigin: string,
): Promise<string | undefined> {
	const cookies = await page.context().cookies(apiOrigin);
	return cookies.find((cookie) => cookie.name === "csrftoken")?.value;
}

async function mockCommentAsNonOwner(
	page: Page,
	targetContent: string,
): Promise<() => Promise<void>> {
	const handler = async (route: Route) => {
		const response = await route.fetch();

		if (route.request().method() !== "GET") {
			await route.fulfill({ response });
			return;
		}

		try {
			const payload = (await response.json()) as CommentListPayload;

			if (Array.isArray(payload.items)) {
				payload.items = payload.items.map((comment) =>
					comment.content === targetContent
						? {
								...comment,
								can_manage: false,
								user_id: NON_OWNER_USER_ID,
								user_name: "E2E Non Owner",
								user_avatar_url: null,
								is_anonymous: false,
							}
						: comment,
				);
			}

			await route.fulfill({ response, json: payload });
		} catch {
			await route.fulfill({ response });
		}
	};

	await page.route(COMMENTS_LIST_ROUTE, handler);
	return () => page.unroute(COMMENTS_LIST_ROUTE, handler);
}

function isRatingCreateResponse(response: PlaywrightResponse): boolean {
	if (response.request().method() !== "POST") {
		return false;
	}

	const pathname = new URL(response.url()).pathname;
	return /^\/api\/v1\/courses\/[0-9a-fA-F-]{36}\/ratings\/$/.test(pathname);
}

function getCourseIdFromUrl(page: Page): string {
	const match = /\/courses\/([0-9a-fA-F-]{36})$/.exec(page.url());
	if (!match) {
		throw new Error(`Could not parse course id from URL: ${page.url()}`);
	}
	return match[1];
}

function uniqueText(testInfo: TestInfo, label: string): string {
	const title = testInfo.title
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 32);

	return `e2e:comments:${label}:${title}:${Date.now()}`;
}
