import { Info } from "lucide-react";

import { UserAvatar } from "@/components/UserAvatar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import { formatDate } from "@/features/courses/courseFormatting";
import { formatInstructorName } from "@/features/instructors/formatInstructorName";
import type {
	CommentAuthor,
	RatingInstructor,
	RatingVoteStrType,
} from "@/lib/api/generated";
import { RatingComment } from "./RatingComment";
import { RatingComments } from "./RatingComments";
import { RatingStats } from "./RatingStats";
import { type OnVoteSettled, RatingVotes } from "./RatingVotes";

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
	readonly instructors?: readonly RatingInstructor[];
	readonly commentEmptyMessage?: string;
	readonly ratingId?: string;
	readonly courseId?: string;
	readonly upvotes: number;
	readonly downvotes: number;
	readonly viewerVote: RatingVoteStrType | null;
	readonly commentsCount?: number;
	readonly commentAuthors?: readonly CommentAuthor[];
	readonly voteDisabledReason?: string;
	readonly onVoteSettled?: OnVoteSettled;
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
	instructors = [],
	commentEmptyMessage,
	ratingId,
	courseId,
	upvotes,
	downvotes,
	viewerVote,
	commentsCount = 0,
	commentAuthors = [],
	voteDisabledReason,
	onVoteSettled,
}: RatingCardBodyProps) {
	const instructorNames = instructors.map(formatInstructorName).filter(Boolean);
	return (
		<>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-2.5">
					<UserAvatar
						name={displayName}
						avatarUrl={avatarUrl}
						isAnonymous={isAnonymous}
						className="size-8 shrink-0 text-xs font-semibold"
					/>
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
						<span className="min-w-0 truncate text-sm font-medium">
							{displayName}
						</span>
						{(courseOfferingLabel || createdAt) && (
							<span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
								{courseOfferingLabel}
								{courseOfferingLabel && createdAt && ", "}
								{createdAt && (
									<time dateTime={createdAt}>{formatDate(createdAt)}</time>
								)}
							</span>
						)}
					</div>
				</div>

				<RatingStats difficulty={difficulty} usefulness={usefulness} />
			</div>

			{instructorNames.length > 0 ? (
				<p className="mt-2 flex min-w-0 items-start gap-1 text-sm text-muted-foreground">
					<span className="shrink-0 font-medium">
						{instructorNames.length > 1 ? "Викладачі:" : "Викладач:"}
					</span>
					<span className="min-w-0 break-words">
						{instructorNames.join(", ")}
					</span>
				</p>
			) : (
				instructor && (
					<p className="mt-2 flex min-w-0 items-start gap-1 text-sm text-muted-foreground">
						<span className="shrink-0 font-medium">Викладач:</span>
						<span className="min-w-0 break-words">{instructor}</span>
						<Tooltip>
							<TooltipTrigger asChild>
								<Info className="size-3.5 shrink-0 cursor-help text-muted-foreground/60" />
							</TooltipTrigger>
							<TooltipContent>Вказано студентом, не перевірено</TooltipContent>
						</Tooltip>
					</p>
				)
			)}

			<div className="mt-2.5">
				<RatingComment comment={comment} emptyMessage={commentEmptyMessage} />
			</div>

			{ratingId && (
				<div className="mt-2">
					<RatingComments
						ratingId={ratingId}
						courseId={courseId}
						commentsCount={commentsCount}
						commentAuthors={commentAuthors}
						trailingContent={
							<RatingVotes
								ratingId={ratingId}
								courseId={courseId}
								initialUpvotes={upvotes}
								initialDownvotes={downvotes}
								initialUserVote={viewerVote}
								disabledReason={voteDisabledReason}
								inline
								onVoteSettled={onVoteSettled}
							/>
						}
					/>
				</div>
			)}
		</>
	);
}
