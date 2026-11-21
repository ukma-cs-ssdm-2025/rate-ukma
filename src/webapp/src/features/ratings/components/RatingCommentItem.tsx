import { useState } from "react";

import {
	infiniteQueryOptions,
	useInfiniteQuery,
	useQueryClient,
} from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Collapsible, CollapsibleContent } from "@/components/ui/Collapsible";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/Toaster";
import type { CommentRead } from "@/lib/api/generated";
import {
	commentsRepliesRetrieve,
	getCommentsRepliesRetrieveQueryKey,
	getRatingsCommentsListQueryKey,
	useCommentsDestroy,
	useCommentsPartialUpdate,
	useRatingsCommentsCreate,
} from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import type { CommentFormValues } from "./RatingCommentParts";
import {
	CommentActions,
	CommentAvatar,
	CommentBody,
	CommentForm,
	RepliesPreview,
} from "./RatingCommentParts";
import {
	REPLIES_PAGE_SIZE,
	invalidateRatingCommentQueries,
	invalidateRepliesQuery,
} from "../ratingCommentQueries";

interface RatingCommentItemProps {
	readonly comment: CommentRead;
	readonly ratingId: string;
	readonly courseId?: string;
	readonly parentListCommentId?: string | null;
}
export function openWhenLoaded<T>(load: () => Promise<T>, open: () => void) {
	load()
		.catch(() => undefined)
		.finally(open);
}

export function RatingCommentItem({
	comment,
	ratingId,
	courseId,
	parentListCommentId = null,
}: RatingCommentItemProps) {
	const queryClient = useQueryClient();
	const [isReplying, setIsReplying] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [showReplies, setShowReplies] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const commentId = comment.id;

	const createComment = useRatingsCommentsCreate();
	const updateComment = useCommentsPartialUpdate();
	const deleteComment = useCommentsDestroy();

	const repliesOptions = infiniteQueryOptions({
		queryKey: getCommentsRepliesRetrieveQueryKey(commentId ?? "", {
			page_size: REPLIES_PAGE_SIZE,
		}),
		queryFn: ({ pageParam }) =>
			commentsRepliesRetrieve(commentId ?? "", {
				page_size: REPLIES_PAGE_SIZE,
				page: pageParam,
			}),
		getNextPageParam: (lastPage) => lastPage.next_page ?? undefined,
		initialPageParam: 1,
	});
	const repliesQuery = useInfiniteQuery({
		...repliesOptions,
		enabled: showReplies && Boolean(commentId),
	});

	if (!commentId) {
		return null;
	}

	const replies = repliesQuery.data?.pages.flatMap((page) => page.items) ?? [];

	const handleReply = async (values: CommentFormValues) => {
		await createComment.mutateAsync({
			ratingId,
			data: {
				content: values.content,
				is_anonymous: values.isAnonymous,
				parent_comment: commentId,
			},
		});

		setIsReplying(false);
		setShowReplies(true);
		invalidateRepliesQuery(queryClient, commentId);
		invalidateRepliesQuery(queryClient, comment.parent_id);
		invalidateRatingCommentQueries(queryClient, ratingId, courseId);
		toast.success("Відповідь додано");
	};

	const handleUpdate = async (values: CommentFormValues) => {
		await updateComment.mutateAsync({
			commentId,
			data: {
				content: values.content,
				is_anonymous: values.isAnonymous,
			},
		});

		setIsEditing(false);
		void queryClient.invalidateQueries({
			queryKey: comment.parent_id
				? getCommentsRepliesRetrieveQueryKey(comment.parent_id)
				: getRatingsCommentsListQueryKey(ratingId),
		});
		if (comment.parent_id) {
			void queryClient.invalidateQueries({
				queryKey: getRatingsCommentsListQueryKey(ratingId),
			});
		}
		toast.success("Коментар оновлено");
	};

	const handleDeleteConfirm = async () => {
		try {
			await deleteComment.mutateAsync({ commentId });
			invalidateRepliesQuery(queryClient, comment.parent_id);
			invalidateRepliesQuery(queryClient, parentListCommentId);
			invalidateRatingCommentQueries(queryClient, ratingId, courseId);
			setIsDeleteOpen(false);
			toast.success("Коментар видалено");
		} catch (error) {
			console.error("Failed to delete comment:", error);
			toast.error("Не вдалося видалити коментар. Спробуйте ще раз");
		}
	};

	const repliesContent = (() => {
		if (repliesQuery.isLoading) {
			return (
				<div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
					<Spinner className="size-3.5" />
					Завантаження відповідей...
				</div>
			);
		}

		if (replies.length > 0) {
			return (
				<>
					{replies.map((reply) => (
						<RatingCommentItem
							key={reply.id}
							comment={reply}
							ratingId={ratingId}
							courseId={courseId}
							parentListCommentId={comment.parent_id}
						/>
					))}
					{repliesQuery.hasNextPage && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs font-medium text-muted-foreground"
							onClick={() => repliesQuery.fetchNextPage()}
							disabled={repliesQuery.isFetchingNextPage}
						>
							{repliesQuery.isFetchingNextPage && (
								<Spinner className="size-3.5" />
							)}
							Показати ще
						</Button>
					)}
				</>
			);
		}

		return null;
	})();

	return (
		<div
			className={cn(comment.parent_id && "border-l-2 border-border pl-3")}
			data-testid={testIds.comments.item}
		>
			<div className="flex items-start gap-2.5">
				<CommentAvatar comment={comment} />
				{isEditing ? (
					<div className="min-w-0 flex-1">
						<CommentForm
							placeholder="Оновіть коментар"
							submitLabel="Зберегти"
							initialContent={comment.content ?? ""}
							initialAnonymous={comment.is_anonymous ?? false}
							isSubmitting={updateComment.isPending}
							onSubmit={handleUpdate}
							onCancel={() => setIsEditing(false)}
							autoFocus
						/>
					</div>
				) : (
					<>
						<CommentBody comment={comment} />
						<CommentActions
							comment={comment}
							onEdit={() => setIsEditing(true)}
							onDelete={() => setIsDeleteOpen(true)}
						/>
					</>
				)}
			</div>

			{!isEditing && (
				<div
					className="mt-2 ml-9 flex flex-wrap items-center gap-1"
					data-testid={testIds.comments.controls}
				>
					<RepliesPreview
						comment={comment}
						showReplies={showReplies}
						onToggle={() =>
							showReplies
								? setShowReplies(false)
								: openWhenLoaded(
										() => queryClient.ensureInfiniteQueryData(repliesOptions),
										() => setShowReplies(true),
									)
						}
					/>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs text-muted-foreground"
						onClick={() => setIsReplying((value) => !value)}
					>
						Відповісти
					</Button>
				</div>
			)}

			<Collapsible open={isReplying}>
				<CollapsibleContent>
					<div className="ml-9 pt-2">
						<CommentForm
							placeholder="Напишіть відповідь"
							submitLabel="Відповісти"
							isSubmitting={createComment.isPending}
							onSubmit={handleReply}
							onCancel={() => setIsReplying(false)}
							autoFocus
						/>
					</div>
				</CollapsibleContent>
			</Collapsible>

			<Collapsible open={showReplies}>
				<CollapsibleContent>
					<div className="ml-9 space-y-2 pt-2">{repliesContent}</div>
				</CollapsibleContent>
			</Collapsible>

			<ConfirmDialog
				open={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
				onConfirm={handleDeleteConfirm}
				title="Видалити коментар?"
				description="Ця дія незворотна. Коментар та всі відповіді на нього буде видалено назавжди."
				confirmText="Видалити"
				cancelText="Скасувати"
				variant="destructive"
			/>
		</div>
	);
}
