import { Pencil, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { formatDate } from "@/features/courses/courseFormatting";
import type { InlineRating, RatingRead } from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";
import { RatingComment } from "./RatingComment";
import { RatingStats } from "./RatingStats";
import { RatingVotes } from "./RatingVotes";

interface ExtendedRating extends InlineRating {
	upvotes?: number;
	downvotes?: number;
	viewer_vote?: "UPVOTE" | "DOWNVOTE" | null;
}

interface UserRatingCardProps {
	readonly rating: RatingRead | ExtendedRating;
	readonly onEdit: () => void;
	readonly onDelete: () => void;
	readonly readOnly?: boolean;
}

export function UserRatingCard({
	rating,
	onEdit,
	onDelete,
	readOnly = false,
}: UserRatingCardProps) {
	const { user } = useAuth();

	const getUserDisplayName = () => {
		if (rating.is_anonymous) {
			return "Анонімний відгук";
		}
		const parts = [user?.lastName, user?.firstName, user?.patronymic].filter(
			Boolean,
		);
		if (parts.length > 0) {
			return parts.join(" ");
		}
		return "Студент";
	};
	const displayName = getUserDisplayName();

	// Use values from rating if available, otherwise use defaults for placeholder
	const upvotes = rating.upvotes ?? 0;
	const downvotes = rating.downvotes ?? 0;
	const viewerVote = rating.viewer_vote ?? null;

	return (
		<article
			className="py-4 px-4 bg-primary/5 rounded-lg border border-primary/20"
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
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>

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

			<RatingComment
				comment={rating.comment}
				emptyMessage="Ви не залишили коментар."
			/>

			<RatingVotes
				ratingId={rating.id ?? ""}
				initialUpvotes={upvotes}
				initialDownvotes={downvotes}
				initialUserVote={viewerVote}
				readOnly={readOnly}
			/>
		</article>
	);
}
