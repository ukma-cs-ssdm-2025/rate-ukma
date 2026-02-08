import { formatDate } from "@/features/courses/courseFormatting";
import type { RatingRead } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { RatingComment } from "./RatingComment";
import { RatingStats } from "./RatingStats";
import { RatingVotes } from "./RatingVotes";

interface RatingCardProps {
	rating: RatingRead;
	readOnly?: boolean;
	disabledMessage?: string;
	sortKey?: string;
}

export function RatingCard({
	rating,
	readOnly = false,
	disabledMessage,
	sortKey,
}: Readonly<RatingCardProps>) {
	const displayName = rating.is_anonymous
		? "Анонімний відгук"
		: rating.student_name || "Студент";

	// Use values from rating if available, otherwise use defaults for placeholder
	const upvotes = rating.upvotes ?? 0;
	const downvotes = rating.downvotes ?? 0;
	const viewerVote = rating.viewer_vote ?? null;

	return (
		<article
			className="py-4 px-4"
			data-testid={testIds.courseDetails.reviewCard}
		>
			<div className="flex flex-wrap items-start justify-between gap-3 mb-2">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span className="font-medium">{displayName}</span>
					{rating.created_at && (
						<>
							<span className="text-muted-foreground/40">•</span>
							<time>{formatDate(rating.created_at)}</time>
						</>
					)}
				</div>
				<RatingStats
					difficulty={rating.difficulty}
					usefulness={rating.usefulness}
				/>
			</div>

			<RatingComment comment={rating.comment} />

			{rating.id && (
				<RatingVotes
					ratingId={rating.id}
					initialUpvotes={upvotes}
					initialDownvotes={downvotes}
					initialUserVote={viewerVote}
					readOnly={readOnly}
					disabledMessage={disabledMessage}
				/>
			)}
		</article>
	);
}
