import { Info } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
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
	readonly courseOfferingLabel?: string;
	readonly difficulty: number | undefined;
	readonly usefulness: number | undefined;
	readonly comment?: string | null;
	readonly instructor?: string | null;
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
	courseOfferingLabel,
	difficulty,
	usefulness,
	comment,
	instructor,
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
				<div className="flex min-w-0 items-start gap-2.5">
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
					<div className="flex min-w-0 flex-col flex-1">
						<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
							<span className="min-w-0 truncate text-sm font-medium">
								{displayName}
							</span>
							{courseOfferingLabel && (
								<span className="shrink-0 text-xs text-muted-foreground">
									{courseOfferingLabel}
								</span>
							)}
						</div>
						{createdAt && (
							<time className="text-xs text-muted-foreground">
								{formatDate(createdAt)}
							</time>
						)}
					</div>
				</div>

				<RatingStats difficulty={difficulty} usefulness={usefulness} />
			</div>

			{instructor && (
				<p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
					<span className="font-medium">Викладач:</span> {instructor}
					<Tooltip>
						<TooltipTrigger asChild>
							<Info className="h-3.5 w-3.5 shrink-0 cursor-help text-muted-foreground/60" />
						</TooltipTrigger>
						<TooltipContent>Вказано студентом, не перевірено</TooltipContent>
					</Tooltip>
				</p>
			)}

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
