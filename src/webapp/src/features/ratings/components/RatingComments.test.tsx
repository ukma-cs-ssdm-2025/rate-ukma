import type { ReactElement, ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as Toaster from "@/components/ui/Toaster";
import type { CommentRead } from "@/lib/api/generated";
import * as generated from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { createMutationStub } from "@/test-utils/mutation-stub";
import { RatingComments } from "./RatingComments";

let mockRatingsCommentsList: ReturnType<typeof vi.spyOn>;
let mockCommentsRepliesRetrieve: ReturnType<typeof vi.spyOn>;
let mockCreateComment: ReturnType<typeof vi.fn>;
let mockUpdateComment: ReturnType<typeof vi.fn>;
let mockDeleteComment: ReturnType<typeof vi.fn>;
function renderWithQuery(ui: ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	}

	return {
		queryClient,
		...render(ui, { wrapper: Wrapper }),
	};
}

function mockCommentList(items: CommentRead[]) {
	return {
		items,
		filters: {},
		page: 1,
		page_size: 5,
		total: items.length,
		total_pages: 1,
		next_page: null,
		previous_page: null,
	};
}

describe("RatingComments", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRatingsCommentsList = vi
			.spyOn(generated, "ratingsCommentsList")
			.mockResolvedValue(mockCommentList([]));
		mockCommentsRepliesRetrieve = vi
			.spyOn(generated, "commentsRepliesRetrieve")
			.mockResolvedValue(mockCommentList([]));
		mockCreateComment = vi.fn().mockResolvedValue({});
		mockUpdateComment = vi.fn().mockResolvedValue({});
		mockDeleteComment = vi.fn().mockResolvedValue(undefined);
		// Stub sonner toasts so failed saves do not reach the real DOM.
		vi.spyOn(Toaster.toast, "success").mockImplementation(() => "");
		vi.spyOn(Toaster.toast, "error").mockImplementation(() => "");
		vi.spyOn(generated, "useCommentsDestroy").mockReturnValue(
			// SAFETY: RatingComments only reads mutateAsync and isPending.
			createMutationStub({ mutateAsync: mockDeleteComment }) as ReturnType<
				typeof generated.useCommentsDestroy
			>,
		);
		vi.spyOn(generated, "useCommentsPartialUpdate").mockReturnValue(
			// SAFETY: RatingComments only reads mutateAsync and isPending.
			createMutationStub({ mutateAsync: mockUpdateComment }) as ReturnType<
				typeof generated.useCommentsPartialUpdate
			>,
		);
		vi.spyOn(generated, "useRatingsCommentsCreate").mockReturnValue(
			// SAFETY: RatingComments only reads mutateAsync and isPending.
			createMutationStub({ mutateAsync: mockCreateComment }) as ReturnType<
				typeof generated.useRatingsCommentsCreate
			>,
		);
	});

	it("shows the first three rating comment avatars reversed in the collapsed button", () => {
		renderWithQuery(
			<RatingComments
				ratingId="rating-1"
				commentsCount={8}
				commentAuthors={[
					{
						user_id: 1,
						user_name: "Alpha One",
						user_avatar_url: null,
						is_anonymous: false,
					},
					{
						user_id: 2,
						user_name: "Bravo Two",
						user_avatar_url: null,
						is_anonymous: false,
					},
					{
						user_id: 3,
						user_name: "Charlie Three",
						user_avatar_url: null,
						is_anonymous: false,
					},
					{
						user_id: 4,
						user_name: "Delta Four",
						user_avatar_url: null,
						is_anonymous: false,
					},
					{
						user_id: 5,
						user_name: "Echo Five",
						user_avatar_url: null,
						is_anonymous: false,
					},
					{
						user_id: 6,
						user_name: "Foxtrot Six",
						user_avatar_url: null,
						is_anonymous: false,
					},
				]}
			/>,
		);

		expect(
			screen.getAllByText(/^(AO|BT|CT)$/).map((element) => element.textContent),
		).toEqual(["CT", "BT", "AO"]);
		expect(screen.queryByText("DF")).not.toBeInTheDocument();
		expect(screen.queryByText("EF")).not.toBeInTheDocument();
		expect(screen.queryByText("FS")).not.toBeInTheDocument();
	});

	it("renders comment preview avatar images for non-anonymous authors", async () => {
		const originalImage = globalThis.Image;
		class LoadedImage extends EventTarget {
			complete = true;
			naturalWidth = 1;
			src = "";
		}
		Object.defineProperty(globalThis, "Image", {
			configurable: true,
			writable: true,
			value: LoadedImage,
		});

		try {
			const { container } = renderWithQuery(
				<RatingComments
					ratingId="rating-1"
					commentsCount={1}
					commentAuthors={[
						{
							user_id: 1,
							user_name: "Bravo Two",
							user_avatar_url: "/media/avatars/bravo.jpg",
							is_anonymous: false,
						},
					]}
				/>,
			);

			await waitFor(() => {
				expect(container.querySelector('img[alt="Bravo Two"]')).toHaveAttribute(
					"src",
					"/media/avatars/bravo.jpg",
				);
			});
		} finally {
			Object.defineProperty(globalThis, "Image", {
				configurable: true,
				writable: true,
				value: originalImage,
			});
		}
	});

	it("loads top-level comments when expanded", async () => {
		const user = userEvent.setup();
		mockRatingsCommentsList.mockResolvedValue(
			mockCommentList([
				{
					id: "comment-1",
					rating_id: "rating-1",
					parent_id: null,
					content: "Useful clarification",
					user_id: 8,
					user_name: "Test User",
					user_avatar_url: null,
					is_anonymous: false,
					can_manage: false,
					created_at: "2026-05-11T12:00:00Z",
					replies_count: 0,
				},
			]),
		);

		renderWithQuery(<RatingComments ratingId="rating-1" commentsCount={1} />);

		await user.click(screen.getByTestId(testIds.comments.toggleButton));

		expect(await screen.findByText("Useful clarification")).toBeInTheDocument();
		expect(
			screen.queryByTestId(testIds.comments.textarea),
		).not.toBeInTheDocument();
		expect(mockRatingsCommentsList).toHaveBeenCalledWith("rating-1", {
			page: 1,
			page_size: 5,
		});
	});

	it("renders anonymous comments with anonymous comment author label", async () => {
		const user = userEvent.setup();
		mockRatingsCommentsList.mockResolvedValue(
			mockCommentList([
				{
					id: "comment-1",
					rating_id: "rating-1",
					parent_id: null,
					content: "Anonymous thought",
					user_id: null,
					user_name: null,
					user_avatar_url: null,
					is_anonymous: true,
					can_manage: false,
					created_at: "2026-05-11T12:00:00Z",
					replies_count: 0,
				},
			]),
		);

		renderWithQuery(<RatingComments ratingId="rating-1" commentsCount={1} />);

		await user.click(screen.getByTestId(testIds.comments.toggleButton));

		const commentItem = await screen.findByTestId(testIds.comments.item);
		expect(commentItem).toHaveTextContent("Анонімний коментар");
	});

	it("keeps replies included in the displayed comments count", async () => {
		const user = userEvent.setup();
		mockRatingsCommentsList.mockResolvedValue(
			mockCommentList([
				{
					id: "comment-1",
					rating_id: "rating-1",
					parent_id: null,
					content: "Useful clarification",
					user_id: 8,
					user_name: "Test User",
					user_avatar_url: null,
					is_anonymous: false,
					can_manage: false,
					created_at: "2026-05-11T12:00:00Z",
					replies_count: 1,
				},
			]),
		);

		renderWithQuery(<RatingComments ratingId="rating-1" commentsCount={2} />);

		await user.click(screen.getByTestId(testIds.comments.toggleButton));
		await screen.findByText("Useful clarification");

		expect(screen.getByTestId(testIds.comments.toggleButton)).toHaveTextContent(
			"2",
		);
	});

	it.each([
		[1, "1 відповідь"],
		[2, "2 відповіді"],
		[4, "4 відповіді"],
		[5, "5 відповідей"],
		[11, "11 відповідей"],
		[14, "14 відповідей"],
		[21, "21 відповідь"],
		[22, "22 відповіді"],
		[25, "25 відповідей"],
	])("formats %i replies as %s", async (repliesCount, expectedText) => {
		const user = userEvent.setup();
		mockRatingsCommentsList.mockResolvedValue(
			mockCommentList([
				{
					id: "comment-1",
					rating_id: "rating-1",
					parent_id: null,
					content: "Useful clarification",
					user_id: 8,
					user_name: "Test User",
					user_avatar_url: null,
					is_anonymous: false,
					can_manage: false,
					created_at: "2026-05-11T12:00:00Z",
					replies_count: repliesCount,
				},
			]),
		);

		renderWithQuery(
			<RatingComments ratingId="rating-1" commentsCount={repliesCount + 1} />,
		);

		await user.click(screen.getByTestId(testIds.comments.toggleButton));
		await screen.findByText("Useful clarification");

		expect(screen.getByText(expectedText)).toBeInTheDocument();
	});

	it("invalidates top-level comments when a reply is updated", async () => {
		const user = userEvent.setup();
		mockRatingsCommentsList.mockResolvedValue(
			mockCommentList([
				{
					id: "comment-1",
					rating_id: "rating-1",
					parent_id: null,
					content: "Parent comment",
					user_id: 8,
					user_name: "Parent Author",
					user_avatar_url: null,
					is_anonymous: false,
					can_manage: false,
					created_at: "2026-05-11T12:00:00Z",
					replies_count: 1,
				},
			]),
		);
		mockCommentsRepliesRetrieve.mockResolvedValue(
			mockCommentList([
				{
					id: "reply-1",
					rating_id: "rating-1",
					parent_id: "comment-1",
					content: "Reply body",
					user_id: 7,
					user_name: "Reply Author",
					user_avatar_url: null,
					is_anonymous: false,
					can_manage: true,
					created_at: "2026-05-11T12:05:00Z",
					replies_count: 0,
				},
			]),
		);
		const { queryClient } = renderWithQuery(
			<RatingComments ratingId="rating-1" commentsCount={2} />,
		);
		const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

		await user.click(screen.getByTestId(testIds.comments.toggleButton));
		await screen.findByText("Parent comment");
		await user.click(screen.getByRole("button", { name: /1/ }));
		const replyItem = (await screen.findByText("Reply body")).closest(
			`[data-testid="${testIds.comments.item}"]`,
		);
		expect(replyItem).not.toBeNull();
		// SAFETY: closest() returned the item node because the reply body rendered inside it.
		const replyElement = replyItem as HTMLElement;

		await user.click(within(replyElement).getAllByRole("button")[0]);
		await user.clear(
			within(replyElement).getByTestId(testIds.comments.textarea),
		);
		await user.type(
			within(replyElement).getByTestId(testIds.comments.textarea),
			"Updated reply",
		);
		await user.click(
			within(replyElement).getByTestId(testIds.comments.submitButton),
		);

		expect(mockUpdateComment).toHaveBeenCalledWith({
			commentId: "reply-1",
			data: {
				content: "Updated reply",
				is_anonymous: false,
			},
		});
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: ["/api/v1/comments/comment-1/replies/"],
		});
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: ["/api/v1/ratings/rating-1/comments/"],
		});
	});

	it("invalidates the parent replies cache when creating a nested reply", async () => {
		const user = userEvent.setup();
		mockRatingsCommentsList.mockResolvedValue(
			mockCommentList([
				{
					id: "comment-1",
					rating_id: "rating-1",
					parent_id: null,
					content: "Parent comment",
					user_id: 8,
					user_name: "Parent Author",
					user_avatar_url: null,
					is_anonymous: false,
					can_manage: false,
					created_at: "2026-05-11T12:00:00Z",
					replies_count: 1,
				},
			]),
		);
		mockCommentsRepliesRetrieve.mockImplementation((commentId: string) =>
			Promise.resolve(
				commentId === "comment-1"
					? mockCommentList([
							{
								id: "reply-1",
								rating_id: "rating-1",
								parent_id: "comment-1",
								content: "Reply body",
								user_id: 7,
								user_name: "Reply Author",
								user_avatar_url: null,
								is_anonymous: false,
								can_manage: false,
								created_at: "2026-05-11T12:05:00Z",
								replies_count: 0,
							},
						])
					: mockCommentList([]),
			),
		);
		const { queryClient } = renderWithQuery(
			<RatingComments ratingId="rating-1" commentsCount={2} />,
		);
		const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

		await user.click(screen.getByTestId(testIds.comments.toggleButton));
		await screen.findByText("Parent comment");
		await user.click(screen.getByRole("button", { name: /1/ }));
		const replyItem = (await screen.findByText("Reply body")).closest(
			`[data-testid="${testIds.comments.item}"]`,
		);
		expect(replyItem).not.toBeNull();
		// SAFETY: closest() returned the item node because the reply body rendered inside it.
		const replyElement = replyItem as HTMLElement;

		await user.click(within(replyElement).getByRole("button"));
		await user.type(
			within(replyElement).getByTestId(testIds.comments.textarea),
			"Nested reply",
		);
		await user.click(
			within(replyElement).getByTestId(testIds.comments.submitButton),
		);

		expect(mockCreateComment).toHaveBeenCalledWith({
			ratingId: "rating-1",
			data: {
				content: "Nested reply",
				is_anonymous: false,
				parent_comment: "reply-1",
			},
		});
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: ["/api/v1/comments/reply-1/replies/"],
		});
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: ["/api/v1/comments/comment-1/replies/"],
		});
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: ["/api/v1/ratings/rating-1/comments/"],
		});
	});

	it("creates a top-level comment", async () => {
		const user = userEvent.setup();

		renderWithQuery(<RatingComments ratingId="rating-1" courseId="course-1" />);

		await user.click(screen.getByRole("button", { name: "Відповісти" }));
		await user.type(
			await screen.findByTestId(testIds.comments.textarea),
			"New comment",
		);
		await user.click(screen.getByTestId(testIds.comments.submitButton));

		expect(mockCreateComment).toHaveBeenCalledWith({
			ratingId: "rating-1",
			data: {
				content: "New comment",
				is_anonymous: false,
			},
		});
	});
});
