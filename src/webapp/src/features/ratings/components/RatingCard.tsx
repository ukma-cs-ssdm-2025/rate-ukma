import type { RatingRead } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { RatingCardBody } from "./RatingCardBody";
import {
	ANONYMOUS_REVIEW_NAME,
	DEFAULT_STUDENT_NAME,
} from "../definitions/ratingDefinitions";

interface RatingCardProps {
	rating: RatingRead;
	courseId?: string;
	singleTerm?: boolean;
	voteDisabledReason?: string;
}

export function RatingCard({
	rating,
	courseId,
	singleTerm = false,
	voteDisabledReason,
}: Readonly<RatingCardProps>) {
	const displayName = rating.is_anonymous
		? ANONYMOUS_REVIEW_NAME
		: rating.student_name || DEFAULT_STUDENT_NAME;

	return (
		<article
			className="px-4 py-4 first:pt-1 last:pb-1 sm:px-5"
			data-testid={testIds.courseDetails.reviewCard}
		>
			<RatingCardBody
				displayName={displayName}
				isAnonymous={rating.is_anonymous ?? false}
				avatarUrl={rating.student_avatar_url}
				createdAt={rating.created_at}
				offeringYear={rating.course_offering_year}
				offeringTerm={rating.course_offering_term}
				singleTerm={singleTerm}
				difficulty={rating.difficulty}
				usefulness={rating.usefulness}
				comment={rating.comment}
				instructor={rating.instructor}
				instructors={rating.instructors ?? []}
				ratingId={rating.id}
				courseId={courseId}
				upvotes={rating.upvotes ?? 0}
				downvotes={rating.downvotes ?? 0}
				viewerVote={rating.viewer_vote ?? null}
				commentsCount={rating.comments_count ?? 0}
				commentAuthors={rating.comment_authors ?? []}
				voteDisabledReason={voteDisabledReason}
			/>
		</article>
	);
}
