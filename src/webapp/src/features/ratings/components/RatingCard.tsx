import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { formatDate } from "@/features/courses/courseFormatting";
import type { RatingRead } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { RatingComment } from "./RatingComment";
import { RatingStats } from "./RatingStats";
import { RatingVotes } from "./RatingVotes";
import { getAvatarColor, getInitials } from "./reviewerAvatar";

interface RatingCardProps {
	rating: RatingRead;
	courseId?: string;
	readOnly?: boolean;
	disabledMessage?: string;
}

export function RatingCard({
	rating,
	courseId,
	readOnly = false,
	disabledMessage,
}: Readonly<RatingCardProps>) {
	const displayName = rating.is_anonymous
		? "Анонімний відгук"
		: rating.student_name || "Студент";

	const upvotes = rating.upvotes ?? 0;
	const downvotes = rating.downvotes ?? 0;
	const viewerVote = rating.viewer_vote ?? null;

	return (
		<article
			className="px-4 py-4"
			data-testid={testIds.courseDetails.reviewCard}
		>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex items-center gap-2.5">
					<Avatar className="h-8 w-8 shrink-0 text-xs font-semibold">
						{rating.student_avatar_url && !rating.is_anonymous && (
							<AvatarImage src={rating.student_avatar_url} alt={displayName} />
						)}
						<AvatarFallback
							className={cn(
								"text-xs font-semibold",
								getAvatarColor(displayName),
							)}
						>
							{getInitials(displayName, rating.is_anonymous ?? false)}
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col">
						<span className="text-sm font-medium">{displayName}</span>
						{rating.created_at && (
							<time className="text-xs text-muted-foreground">
								{formatDate(rating.created_at)}
							</time>
						)}
					</div>
				</div>

				<RatingStats
					difficulty={rating.difficulty}
					usefulness={rating.usefulness}
				/>
			</div>

			<div className="mt-3">
				<RatingComment comment={rating.comment} />
			</div>

			<div className="mt-3 flex items-center justify-end">
				{rating.id && (
					<RatingVotes
						ratingId={rating.id}
						courseId={courseId}
						initialUpvotes={upvotes}
						initialDownvotes={downvotes}
						initialUserVote={viewerVote}
						readOnly={readOnly}
						disabledMessage={disabledMessage}
						inline
					/>
				)}
			</div>
		</article>
	);
}
