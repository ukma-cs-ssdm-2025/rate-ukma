import type { RatingRead } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { RatingCardBody } from "./RatingCardBody";

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

	return (
		<article
			className="px-4 py-4"
			data-testid={testIds.courseDetails.reviewCard}
		>
			<RatingCardBody
				displayName={displayName}
				isAnonymous={rating.is_anonymous ?? false}
				avatarUrl={rating.student_avatar_url}
				createdAt={rating.created_at}
				difficulty={rating.difficulty}
				usefulness={rating.usefulness}
				comment={rating.comment}
				ratingId={rating.id}
				courseId={courseId}
				upvotes={rating.upvotes ?? 0}
				downvotes={rating.downvotes ?? 0}
				viewerVote={rating.viewer_vote ?? null}
				votesReadOnly={readOnly}
				votesDisabledMessage={disabledMessage}
			/>
		</article>
	);
}
