import type { ReactElement, ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import { RatingComments } from "./RatingComments";

const apiMocks = vi.hoisted(() => ({
	ratingsCommentsList: vi.fn(),
	commentsRepliesRetrieve: vi.fn(),
	createComment: vi.fn(),
	updateComment: vi.fn(),
	deleteComment: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	useAuth: () => ({
		user: { id: 7 },
	}),
}));

vi.mock("@/components/ui/Toaster", () => ({
	toast: {
		success: apiMocks.toastSuccess,
		error: apiMocks.toastError,
	},
}));

vi.mock("@/lib/api/generated", () => ({
	commentsRepliesRetrieve: apiMocks.commentsRepliesRetrieve,
	getCommentsRepliesRetrieveQueryKey: (
		commentId?: string,
		params?: Record<string, unknown>,
	) => ["comment-replies", commentId, params].filter(Boolean),
	getCoursesRatingsListQueryKey: (courseId?: string) => [
		"course-ratings",
		courseId,
	],
	getRatingsCommentsListQueryKey: (
		ratingId?: string,
		params?: Record<string, unknown>,
	) => ["rating-comments", ratingId, params].filter(Boolean),
	ratingsCommentsList: apiMocks.ratingsCommentsList,
	useCommentsDestroy: () => ({
		mutateAsync: apiMocks.deleteComment,
		isPending: false,
	}),
	useCommentsPartialUpdate: () => ({
		mutateAsync: apiMocks.updateComment,
		isPending: false,
	}),
	useRatingsCommentsCreate: () => ({
		mutateAsync: apiMocks.createComment,
		isPending: false,
	}),
}));

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

	return render(ui, { wrapper: Wrapper });
}

function mockCommentList(items: unknown[]) {
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
		apiMocks.ratingsCommentsList.mockResolvedValue(mockCommentList([]));
		apiMocks.commentsRepliesRetrieve.mockResolvedValue(mockCommentList([]));
		apiMocks.createComment.mockResolvedValue({});
		apiMocks.updateComment.mockResolvedValue({});
		apiMocks.deleteComment.mockResolvedValue(undefined);
	});

	it("shows only the first five rating comment avatars in the collapsed button", () => {
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

		expect(screen.getByText("AO")).toBeInTheDocument();
		expect(screen.getByText("BT")).toBeInTheDocument();
		expect(screen.getByText("CT")).toBeInTheDocument();
		expect(screen.getByText("DF")).toBeInTheDocument();
		expect(screen.getByText("EF")).toBeInTheDocument();
		expect(screen.queryByText("FS")).not.toBeInTheDocument();
	});

	it("loads top-level comments when expanded", async () => {
		const user = userEvent.setup();
		apiMocks.ratingsCommentsList.mockResolvedValue(
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
					created_at: "2026-05-11T12:00:00Z",
					replies_count: 0,
				},
			]),
		);

		renderWithQuery(<RatingComments ratingId="rating-1" commentsCount={1} />);

		await user.click(screen.getByTestId(testIds.comments.toggleButton));

		expect(await screen.findByText("Useful clarification")).toBeInTheDocument();
		expect(apiMocks.ratingsCommentsList).toHaveBeenCalledWith("rating-1", {
			page: 1,
			page_size: 5,
		});
	});

	it("keeps replies included in the displayed comments count", async () => {
		const user = userEvent.setup();
		apiMocks.ratingsCommentsList.mockResolvedValue(
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
					created_at: "2026-05-11T12:00:00Z",
					replies_count: 1,
					reply_authors: [
						{
							user_id: 9,
							user_name: "Reply Author",
							user_avatar_url: null,
							is_anonymous: false,
						},
					],
				},
			]),
		);

		renderWithQuery(<RatingComments ratingId="rating-1" commentsCount={2} />);

		await user.click(screen.getByTestId(testIds.comments.toggleButton));
		await screen.findByText("Useful clarification");

		expect(screen.getByTestId(testIds.comments.toggleButton)).toHaveTextContent(
			"2",
		);
		expect(screen.getByText("RA")).toBeInTheDocument();
	});

	it("creates a top-level comment", async () => {
		const user = userEvent.setup();

		renderWithQuery(<RatingComments ratingId="rating-1" courseId="course-1" />);

		await user.click(screen.getByTestId(testIds.comments.toggleButton));
		await user.type(
			await screen.findByTestId(testIds.comments.textarea),
			"New comment",
		);
		await user.click(screen.getByTestId(testIds.comments.submitButton));

		expect(apiMocks.createComment).toHaveBeenCalledWith({
			ratingId: "rating-1",
			data: {
				content: "New comment",
				is_anonymous: false,
				created_at: expect.any(String),
			},
		});
	});
});
