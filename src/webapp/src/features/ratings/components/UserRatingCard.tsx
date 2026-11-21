import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	ANONYMOUS_REVIEW_NAME,
	CANNOT_VOTE_OWN_RATING_TEXT,
	DEFAULT_STUDENT_NAME,
} from "@/features/ratings/definitions/ratingDefinitions";
import type { InlineRating, RatingRead } from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";
import { RatingCardBody } from "./RatingCardBody";

interface UserRatingCardProps {
	readonly rating: RatingRead | InlineRating;
	readonly courseId?: string;
	readonly onEdit: () => void;
	readonly onDelete: () => void;
}

export function UserRatingCard({
	rating,
	courseId,
	onEdit,
	onDelete,
}: UserRatingCardProps) {
	const { user } = useAuth();

	const getUserDisplayName = () => {
		if (rating.is_anonymous) {
			return ANONYMOUS_REVIEW_NAME;
		}
		const parts = [user?.lastName, user?.firstName, user?.patronymic].filter(
			Boolean,
		);
		if (parts.length > 0) {
			return parts.join(" ");
		}
		return DEFAULT_STUDENT_NAME;
	};
	const displayName = getUserDisplayName();
	// The course page passes the full read model; right after saving, only the
	// inline rating from the student's courses is known.
	const read = "course_offering_year" in rating ? rating : null;

	return (
		<article
			className="rounded-xl bg-card-user p-4 sm:p-5"
			data-testid={testIds.courseDetails.reviewCard}
		>
			<div className="mb-2 flex items-center justify-between">
				<div className="flex items-center gap-2 text-xs">
					<span className="font-medium text-primary">Ваша оцінка</span>
				</div>
				<div className="flex items-center gap-1">
					<Button
						size="sm"
						variant="ghost"
						onClick={onEdit}
						aria-label="Редагувати оцінку"
						className="size-7 p-0 text-muted-foreground"
						data-testid={testIds.courseDetails.editUserRatingButton}
					>
						<Pencil className="size-3.5" />
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={onDelete}
						aria-label="Видалити оцінку"
						className="size-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
						data-testid={testIds.rating.deleteButton}
					>
						<Trash2 className="size-3.5" />
					</Button>
				</div>
			</div>

			<RatingCardBody
				displayName={displayName}
				isAnonymous={rating.is_anonymous}
				avatarUrl={!rating.is_anonymous ? user?.avatarUrl : undefined}
				createdAt={rating.created_at}
				offeringYear={read?.course_offering_year}
				offeringTerm={read?.course_offering_term}
				difficulty={rating.difficulty}
				usefulness={rating.usefulness}
				comment={rating.comment}
				instructor={rating.instructor}
				instructors={rating.instructors}
				commentEmptyMessage="Ви не залишили коментар."
				ratingId={rating.id}
				courseId={courseId}
				upvotes={read?.upvotes ?? 0}
				downvotes={read?.downvotes ?? 0}
				viewerVote={read?.viewer_vote ?? null}
				commentsCount={read?.comments_count ?? 0}
				commentAuthors={read?.comment_authors ?? []}
				voteDisabledReason={CANNOT_VOTE_OWN_RATING_TEXT}
			/>
		</article>
	);
}
