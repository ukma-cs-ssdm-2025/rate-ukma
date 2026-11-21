import { useState } from "react";
import type { ReactNode } from "react";

import {
	infiniteQueryOptions,
	useInfiniteQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Collapsible, CollapsibleContent } from "@/components/ui/Collapsible";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/Toaster";
import type { CommentAuthor } from "@/lib/api/generated";
import {
	getRatingsCommentsListQueryKey,
	ratingsCommentsList,
	useRatingsCommentsCreate,
} from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { RatingCommentItem, openWhenLoaded } from "./RatingCommentItem";
import type { CommentFormValues } from "./RatingCommentParts";
import {
	CommentAuthorsPreview,
	CommentForm,
	formatCount,
} from "./RatingCommentParts";
import {
	COMMENTS_PAGE_SIZE,
	invalidateRatingCommentQueries,
} from "../ratingCommentQueries";

interface RatingCommentsProps {
	readonly ratingId: string;
	readonly courseId?: string;
	readonly commentsCount?: number;
	readonly commentAuthors?: readonly CommentAuthor[];
	readonly trailingContent?: ReactNode;
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

	const commentsOptions = infiniteQueryOptions({
		queryKey: getRatingsCommentsListQueryKey(ratingId, {
			page_size: COMMENTS_PAGE_SIZE,
		}),
		queryFn: ({ pageParam }) =>
			ratingsCommentsList(ratingId, {
				page_size: COMMENTS_PAGE_SIZE,
				page: pageParam,
			}),
		getNextPageParam: (lastPage) => lastPage.next_page ?? undefined,
		initialPageParam: 1,
	});
	const commentsQuery = useInfiniteQuery({
		...commentsOptions,
		enabled: isExpanded && Boolean(ratingId),
	});
	const openComments = () =>
		openWhenLoaded(
			() => queryClient.ensureInfiniteQueryData(commentsOptions),
			() => setIsExpanded(true),
		);

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
		if (isExpanded) {
			setIsExpanded(false);
			setIsCreating(false);
		} else {
			openComments();
		}
	};

	const handleStartComment = () => {
		setIsCreating(true);
		openComments();
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
				<div className="space-y-3">
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
			<div className="flex items-center justify-between gap-2">
				<div className="flex flex-wrap items-center gap-2">
					{hasComments && (
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
					)}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							"h-8 px-2 text-xs font-semibold text-muted-foreground hover:bg-transparent hover:text-primary",
							!hasComments && "-ml-2",
						)}
						onClick={handleStartComment}
					>
						Відповісти
					</Button>
				</div>
				{trailingContent && <div className="shrink-0">{trailingContent}</div>}
			</div>

			<Collapsible open={isExpanded}>
				<CollapsibleContent>
					<div className="mt-2 mb-1 w-full space-y-3 border-l-2 border-border pl-3">
						<Collapsible open={isCreating} className="empty:hidden">
							<CollapsibleContent>
								<div className="pt-1">
									<CommentForm
										placeholder="Напишіть коментар"
										submitLabel="Коментувати"
										isSubmitting={createComment.isPending}
										onSubmit={handleCreate}
										onCancel={handleCancelCreate}
										autoFocus
									/>
								</div>
							</CollapsibleContent>
						</Collapsible>

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
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}
