import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { formatDate } from "@/features/courses/courseFormatting";
import type { RatingVoteStrType } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { RatingComment } from "./RatingComment";
import { RatingStats } from "./RatingStats";
import { RatingVotes } from "./RatingVotes";
import { getAvatarColor, getInitials } from "./reviewerAvatar";

interface RatingCardBodyProps {
	readonly displayName: string;
	readonly isAnonymous: boolean;
	readonly avatarUrl?: string | null;
	readonly createdAt?: string | null;
	readonly difficulty: number | undefined;
	readonly usefulness: number | undefined;
	readonly comment?: string | null;
	readonly commentEmptyMessage?: string;
	readonly ratingId?: string;
	readonly courseId?: string;
	readonly upvotes: number;
	readonly downvotes: number;
	readonly viewerVote: RatingVoteStrType | null;
	readonly votesReadOnly?: boolean;
	readonly votesDisabledMessage?: string;
}

export function RatingCardBody({
	displayName,
	isAnonymous,
	avatarUrl,
	createdAt,
	difficulty,
	usefulness,
	comment,
	commentEmptyMessage,
	ratingId,
	courseId,
	upvotes,
	downvotes,
	viewerVote,
	votesReadOnly = false,
	votesDisabledMessage,
}: RatingCardBodyProps) {
	return (
		<>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex min-w-0 items-center gap-2.5">
					<Avatar className="h-8 w-8 shrink-0 text-xs font-semibold">
						{avatarUrl && !isAnonymous && (
							<AvatarImage src={avatarUrl} alt={displayName} />
						)}
						<AvatarFallback
							className={cn(
								"text-xs font-semibold",
								getAvatarColor(displayName),
							)}
						>
							{getInitials(displayName, isAnonymous)}
						</AvatarFallback>
					</Avatar>
					<div className="flex min-w-0 flex-col">
						<span className="truncate text-sm font-medium">{displayName}</span>
						{createdAt && (
							<time className="text-xs text-muted-foreground">
								{formatDate(createdAt)}
							</time>
						)}
					</div>
				</div>

				<RatingStats difficulty={difficulty} usefulness={usefulness} />
			</div>

			<div className="mt-3">
				<RatingComment comment={comment} emptyMessage={commentEmptyMessage} />
			</div>

			<div className="mt-3 flex items-center justify-end">
				{ratingId && (
					<RatingVotes
						ratingId={ratingId}
						courseId={courseId}
						initialUpvotes={upvotes}
						initialDownvotes={downvotes}
						initialUserVote={viewerVote}
						readOnly={votesReadOnly}
						disabledMessage={votesDisabledMessage}
						inline
					/>
				)}
			</div>
		</>
	);
}
