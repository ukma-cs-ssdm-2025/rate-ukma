import { Pencil, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	ANONYMOUS_REVIEW_NAME,
	CANNOT_VOTE_OWN_RATING_TEXT,
	DEFAULT_STUDENT_NAME,
} from "@/features/ratings/definitions/ratingDefinitions";
import type {
	InlineRating,
	RatingRead,
	RatingVoteStrType,
} from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";
import { RatingCardBody } from "./RatingCardBody";

interface ExtendedRating extends InlineRating {
	upvotes?: number;
	downvotes?: number;
	viewer_vote?: RatingVoteStrType | null;
}

interface UserRatingCardProps {
	readonly rating: RatingRead | ExtendedRating;
	readonly onEdit: () => void;
	readonly onDelete: () => void;
}

export function UserRatingCard({
	rating,
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

	return (
		<article
			className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4"
			data-testid={testIds.courseDetails.reviewCard}
		>
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2 text-xs">
					<Star className="h-3.5 w-3.5 text-primary fill-primary" />
					<span className="font-medium text-primary">Ваша оцінка</span>
				</div>
				<div className="flex items-center gap-1">
					<Button
						size="sm"
						variant="ghost"
						onClick={onEdit}
						aria-label="Редагувати оцінку"
						className="h-7 w-7 p-0"
					>
						<Pencil className="h-3.5 w-3.5" />
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={onDelete}
						aria-label="Видалити оцінку"
						className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
						data-testid={testIds.rating.deleteButton}
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>

			<RatingCardBody
				displayName={displayName}
				isAnonymous={rating.is_anonymous ?? false}
				avatarUrl={!rating.is_anonymous ? user?.avatarUrl : undefined}
				createdAt={rating.created_at}
				difficulty={rating.difficulty}
				usefulness={rating.usefulness}
				comment={rating.comment}
				commentEmptyMessage="Ви не залишили коментар."
				ratingId={rating.id}
				upvotes={rating.upvotes ?? 0}
				downvotes={rating.downvotes ?? 0}
				viewerVote={rating.viewer_vote ?? null}
				votesReadOnly={true}
				votesDisabledMessage={CANNOT_VOTE_OWN_RATING_TEXT}
			/>
		</article>
	);
}
