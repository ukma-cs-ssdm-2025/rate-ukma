import { type FormEvent, type ReactNode, useId, useState } from "react";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Pencil, Reply, Trash2 } from "lucide-react";

import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toaster";
import { formatDate } from "@/features/courses/courseFormatting";
import {
	ANONYMOUS_REVIEW_NAME,
	DEFAULT_STUDENT_NAME,
} from "@/features/ratings/definitions/ratingDefinitions";
import type { CommentAuthor, CommentRead } from "@/lib/api/generated";
import {
	commentsRepliesRetrieve,
	getCommentsRepliesRetrieveQueryKey,
	getCoursesRatingsListQueryKey,
	getRatingsCommentsListQueryKey,
	ratingsCommentsList,
	useCommentsDestroy,
	useCommentsPartialUpdate,
	useRatingsCommentsCreate,
} from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";

const COMMENTS_PAGE_SIZE = 5;
const REPLIES_PAGE_SIZE = 5;

interface RatingCommentsProps {
	readonly ratingId: string;
	readonly courseId?: string;
	readonly commentsCount?: number;
	readonly commentAuthors?: readonly CommentAuthor[];
	readonly trailingContent?: ReactNode;
}

interface CommentFormValues {
	readonly content: string;
	readonly isAnonymous: boolean;
}

interface CommentFormProps {
	readonly placeholder: string;
	readonly submitLabel: string;
	readonly initialContent?: string;
	readonly initialAnonymous?: boolean;
	readonly isSubmitting?: boolean;
	readonly onSubmit: (values: CommentFormValues) => Promise<void>;
	readonly onCancel?: () => void;
	readonly autoFocus?: boolean;
}

interface RatingCommentItemProps {
	readonly comment: CommentRead;
	readonly ratingId: string;
	readonly courseId?: string;
}

interface CommentActionsProps {
	readonly comment: CommentRead;
	readonly onEdit: () => void;
	readonly onDelete: () => void;
}

type CommentPreviewAuthor = CommentAuthor;

function invalidateRatingCommentQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	ratingId: string,
	courseId?: string,
) {
	queryClient.invalidateQueries({
		queryKey: getRatingsCommentsListQueryKey(ratingId),
	});

	if (courseId) {
		queryClient.invalidateQueries({
			queryKey: getCoursesRatingsListQueryKey(courseId),
			refetchType: "none",
		});
	}
}

function getAuthorName(author: {
	readonly is_anonymous?: boolean;
	readonly user_name?: string | null;
}) {
	if (author.is_anonymous) {
		return ANONYMOUS_REVIEW_NAME;
	}
	return author.user_name || DEFAULT_STUDENT_NAME;
}

function getCommentAuthor(comment: CommentRead) {
	return getAuthorName(comment);
}

function formatCount(value: number | undefined): string {
	return new Intl.NumberFormat("uk-UA").format(value ?? 0);
}

function formatReply(value: number): string {
	const lastDigit = value % 10;
	const lastTwoDigits = value % 100;

	if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
		return "відповідей";
	}

	if (lastDigit === 1) {
		return "відповідь";
	}

	if (lastDigit >= 2 && lastDigit <= 4) {
		return "відповіді";
	}

	return "відповідей";
}

function CommentForm({
	placeholder,
	submitLabel,
	initialContent = "",
	initialAnonymous = false,
	isSubmitting = false,
	onSubmit,
	onCancel,
	autoFocus = false,
}: CommentFormProps) {
	const anonymousId = useId();
	const [content, setContent] = useState(initialContent);
	const [isAnonymous, setIsAnonymous] = useState(initialAnonymous);
	const trimmedContent = content.trim();

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!trimmedContent || isSubmitting) {
			return;
		}

		try {
			await onSubmit({
				content: trimmedContent,
				isAnonymous,
			});
		} catch (error) {
			console.error("Failed to save comment:", error);
			toast.error("Не вдалося зберегти коментар. Спробуйте ще раз");
			return;
		}

		if (!initialContent) {
			setContent("");
			setIsAnonymous(false);
		}
	};

	return (
		<form className="space-y-2" onSubmit={handleSubmit}>
			<Textarea
				value={content}
				onChange={(event) => setContent(event.target.value)}
				placeholder={placeholder}
				autoFocus={autoFocus}
				rows={3}
				className="min-h-20 resize-y text-sm"
				maxLength={2000}
				data-testid={testIds.comments.textarea}
			/>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<Label
					htmlFor={anonymousId}
					className="cursor-pointer text-xs text-muted-foreground"
				>
					<Checkbox
						id={anonymousId}
						checked={isAnonymous}
						onCheckedChange={(checked) => setIsAnonymous(checked === true)}
						data-testid={testIds.comments.anonymousCheckbox}
					/>
					Анонімно
				</Label>
				<div className="flex items-center justify-end gap-2">
					{onCancel && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onCancel}
							disabled={isSubmitting}
						>
							Скасувати
						</Button>
					)}
					<Button
						type="submit"
						size="sm"
						disabled={!trimmedContent || isSubmitting}
						data-testid={testIds.comments.submitButton}
					>
						{isSubmitting && <Spinner className="size-3.5" />}
						{submitLabel}
					</Button>
				</div>
			</div>
		</form>
	);
}

function CommentActions({ comment, onEdit, onDelete }: CommentActionsProps) {
	const isOwner = comment.can_manage;

	if (!isOwner) {
		return null;
	}

	return (
		<div className="flex shrink-0 items-center gap-1">
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="size-7"
				onClick={onEdit}
				aria-label="Редагувати коментар"
				data-testid={testIds.comments.editButton}
			>
				<Pencil className="size-3.5" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
				onClick={onDelete}
				aria-label="Видалити коментар"
				data-testid={testIds.comments.deleteButton}
			>
				<Trash2 className="size-3.5" />
			</Button>
		</div>
	);
}

function CommentBody({ comment }: Readonly<{ comment: CommentRead }>) {
	const author = getCommentAuthor(comment);

	return (
		<div className="min-w-0 flex-1">
			<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
				<span className="min-w-0 truncate text-sm font-medium">{author}</span>
				{comment.created_at && (
					<time className="text-xs text-muted-foreground">
						{formatDate(comment.created_at)}
					</time>
				)}
			</div>
			<p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
				{comment.content}
			</p>
		</div>
	);
}

function CommentAvatar({ comment }: Readonly<{ comment: CommentRead }>) {
	return (
		<UserAvatar
			name={getCommentAuthor(comment)}
			avatarUrl={comment.user_avatar_url}
			isAnonymous={comment.is_anonymous ?? false}
			className="size-7 shrink-0 text-[11px] font-semibold"
		/>
	);
}

function PreviewAuthorAvatar({
	author,
	index,
}: Readonly<{
	author: CommentPreviewAuthor;
	index: number;
}>) {
	return (
		<UserAvatar
			name={getAuthorName(author)}
			avatarUrl={author.user_avatar_url}
			isAnonymous={author.is_anonymous ?? false}
			className={cn(
				"size-7 text-[10px] font-semibold",
				"bg-[color:var(--avatar-ring-color,var(--card))] p-[2px]",
				index > 0 && "-ml-2",
			)}
		/>
	);
}

function CommentAuthorsPreview({
	authors,
}: Readonly<{
	authors?: readonly CommentAuthor[];
}>) {
	const previewAuthors = authors?.length ? authors.slice(0, 3).reverse() : [];

	if (previewAuthors.length === 0) {
		return null;
	}

	return (
		<span className="flex items-center" aria-hidden="true">
			{previewAuthors.map((author, index) => (
				<PreviewAuthorAvatar
					key={`${author.user_id ?? "anonymous"}-${index}`}
					author={author}
					index={index}
				/>
			))}
		</span>
	);
}

function RepliesPreview({
	comment,
	showReplies,
	onToggle,
}: Readonly<{
	comment: CommentRead;
	showReplies: boolean;
	onToggle: () => void;
}>) {
	const replyCount = comment.replies_count ?? 0;

	if (replyCount === 0) {
		return null;
	}

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="h-7 gap-2 px-1.5 text-xs text-muted-foreground"
			onClick={onToggle}
			aria-expanded={showReplies}
		>
			<span className="font-semibold text-primary">
				{formatCount(replyCount)} {formatReply(replyCount)}
			</span>
			{showReplies ? (
				<ChevronUp className="size-3.5" />
			) : (
				<ChevronDown className="size-3.5" />
			)}
		</Button>
	);
}

function RatingCommentItem({
	comment,
	ratingId,
	courseId,
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

	const repliesQuery = useInfiniteQuery({
		queryKey: getCommentsRepliesRetrieveQueryKey(commentId, {
			page_size: REPLIES_PAGE_SIZE,
		}),
		queryFn: ({ pageParam }) =>
			commentsRepliesRetrieve(commentId ?? "", {
				page_size: REPLIES_PAGE_SIZE,
				page: pageParam as number,
			}),
		getNextPageParam: (lastPage) => lastPage.next_page ?? undefined,
		initialPageParam: 1,
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
		queryClient.invalidateQueries({
			queryKey: getCommentsRepliesRetrieveQueryKey(commentId),
		});
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
		queryClient.invalidateQueries({
			queryKey: comment.parent_id
				? getCommentsRepliesRetrieveQueryKey(comment.parent_id)
				: getRatingsCommentsListQueryKey(ratingId),
		});
		if (comment.parent_id) {
			queryClient.invalidateQueries({
				queryKey: getRatingsCommentsListQueryKey(ratingId),
			});
		}
		toast.success("Коментар оновлено");
	};

	const handleDeleteConfirm = async () => {
		try {
			await deleteComment.mutateAsync({ commentId });
			queryClient.invalidateQueries({
				queryKey: comment.parent_id
					? getCommentsRepliesRetrieveQueryKey(comment.parent_id)
					: getRatingsCommentsListQueryKey(ratingId),
			});
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
						/>
					))}
					{repliesQuery.hasNextPage && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs text-muted-foreground"
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
			className={cn(
				"space-y-2",
				comment.parent_id && "border-l border-border/60 pl-3",
			)}
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
				<div className="ml-9 flex flex-wrap items-center gap-2">
					<RepliesPreview
						comment={comment}
						showReplies={showReplies}
						onToggle={() => setShowReplies((value) => !value)}
					/>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs text-muted-foreground"
						onClick={() => setIsReplying((value) => !value)}
					>
						<Reply className="size-3.5" />
						Відповісти
					</Button>
				</div>
			)}

			{isReplying && (
				<div className="ml-9">
					<CommentForm
						placeholder="Напишіть відповідь"
						submitLabel="Відповісти"
						isSubmitting={createComment.isPending}
						onSubmit={handleReply}
						onCancel={() => setIsReplying(false)}
						autoFocus
					/>
				</div>
			)}

			{showReplies && <div className="ml-9 space-y-3">{repliesContent}</div>}

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

export function RatingComments({
	ratingId,
	courseId,
	commentsCount = 0,
	commentAuthors,
	trailingContent,
}: RatingCommentsProps) {
	const queryClient = useQueryClient();
	const [isExpanded, setIsExpanded] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const createComment = useRatingsCommentsCreate();

	const commentsQuery = useInfiniteQuery({
		queryKey: getRatingsCommentsListQueryKey(ratingId, {
			page_size: COMMENTS_PAGE_SIZE,
		}),
		queryFn: ({ pageParam }) =>
			ratingsCommentsList(ratingId, {
				page_size: COMMENTS_PAGE_SIZE,
				page: pageParam as number,
			}),
		getNextPageParam: (lastPage) => lastPage.next_page ?? undefined,
		initialPageParam: 1,
		enabled: isExpanded && Boolean(ratingId),
	});

	const comments =
		commentsQuery.data?.pages.flatMap((page) => page.items) ?? [];
	const loadedCommentsCount = comments.reduce(
		(total, comment) => total + 1 + (comment.replies_count ?? 0),
		0,
	);
	const displayedCount = Math.max(
		commentsCount,
		loadedCommentsCount,
		commentsQuery.data?.pages[0]?.total ?? 0,
	);
	const hasComments = displayedCount > 0;

	const handleCreate = async (values: CommentFormValues) => {
		await createComment.mutateAsync({
			ratingId,
			data: {
				content: values.content,
				is_anonymous: values.isAnonymous,
			},
		});

		invalidateRatingCommentQueries(queryClient, ratingId, courseId);
		setIsCreating(false);
		toast.success("Коментар додано");
	};

	const handleToggleComments = () => {
		setIsExpanded((value) => {
			if (value) {
				setIsCreating(false);
			}
			return !value;
		});
	};

	const handleStartComment = () => {
		setIsExpanded(true);
		setIsCreating(true);
	};

	const handleCancelCreate = () => {
		setIsCreating(false);
		if (!hasComments) {
			setIsExpanded(false);
		}
	};

	const commentsContent = (() => {
		if (commentsQuery.isLoading) {
			return (
				<div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
					<Spinner className="size-4" />
					Завантаження коментарів...
				</div>
			);
		}

		if (comments.length > 0) {
			return (
				<div className="space-y-4">
					{comments.map((comment) => (
						<RatingCommentItem
							key={comment.id}
							comment={comment}
							ratingId={ratingId}
							courseId={courseId}
						/>
					))}
				</div>
			);
		}

		return (
			<p className="py-2 text-sm text-muted-foreground">Коментарів ще немає.</p>
		);
	})();

	return (
		<div className="min-w-0 w-full">
			<div className="flex items-start justify-between gap-2">
				<div className="flex flex-wrap items-center gap-2">
					{hasComments ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 px-0 text-muted-foreground hover:bg-transparent hover:text-primary"
							onClick={handleToggleComments}
							aria-expanded={isExpanded}
							data-testid={testIds.comments.toggleButton}
						>
							<CommentAuthorsPreview authors={commentAuthors} />
							<span className="text-xs font-medium">
								Коментарі {formatCount(displayedCount)}
							</span>
							<span className="flex size-3.5 items-center justify-center">
								{isExpanded ? (
									<ChevronUp className="size-3.5" />
								) : (
									<ChevronDown className="size-3.5" />
								)}
							</span>
						</Button>
					) : (
						<span className="flex h-8 items-center text-xs font-medium text-muted-foreground">
							Коментарі {formatCount(displayedCount)}
						</span>
					)}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 px-2 text-xs font-semibold text-muted-foreground hover:bg-transparent hover:text-primary"
						onClick={handleStartComment}
					>
						Відповісти
					</Button>
				</div>
				{trailingContent && <div className="shrink-0">{trailingContent}</div>}
			</div>

			{isExpanded && (
				<div className="mt-3 w-full space-y-4 rounded-lg border border-border/50 bg-background p-3">
					{isCreating && (
						<CommentForm
							placeholder="Напишіть коментар"
							submitLabel="Коментувати"
							isSubmitting={createComment.isPending}
							onSubmit={handleCreate}
							onCancel={handleCancelCreate}
							autoFocus
						/>
					)}

					{commentsContent}

					{commentsQuery.hasNextPage && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-full"
							onClick={() => commentsQuery.fetchNextPage()}
							disabled={commentsQuery.isFetchingNextPage}
						>
							{commentsQuery.isFetchingNextPage && (
								<Spinner className="size-3.5" />
							)}
							Показати ще
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
