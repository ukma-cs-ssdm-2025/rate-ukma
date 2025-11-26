import { useState } from "react";

import { Card, CardContent } from "@/components/ui/Card";
import {
	formatDate,
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { DeleteRatingDialog } from "./DeleteRatingDialog";
import { RatingCardHeader } from "./MyRatingCard/RatingCardHeader";
import { RatingCommentDisplay } from "./MyRatingCard/RatingCommentDisplay";
import { RatingMetric } from "./MyRatingCard/RatingMetric";

interface MyRatingCardProps {
	course: StudentRatingsDetailed;
	onRatingChanged: () => undefined | Promise<unknown>;
}

export function MyRatingCard({
	course,
	onRatingChanged,
}: Readonly<MyRatingCardProps>) {
	const courseId = course.course_id;
	const rating = course.rated ?? null;

	const difficultyValue =
		typeof rating?.difficulty === "number" ? rating.difficulty.toFixed(1) : "—";
	const usefulnessValue =
		typeof rating?.usefulness === "number" ? rating.usefulness.toFixed(1) : "—";
	const comment = rating?.comment?.trim();
	const hasRating = Boolean(rating);
	const canModify = Boolean(hasRating && rating?.id && courseId);
	const [isEditing, setIsEditing] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);

	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const onDeleteSuccess = () => {
		setIsEditing(false);
		onRatingChanged();
	};

	const disableActions = false; // This can be removed since it's not used anymore

	const handleEditToggle = () => {
		setActionError(null);
		setIsEditing((previous) => !previous);
		// TODO: Implement edit form
	};

	return (
		<Card className="border border-border/70 bg-background/80 transition-shadow duration-300 hover:shadow-xl">
			<RatingCardHeader
				courseTitle={course.course_title}
				courseCode={course.course_code ?? undefined}
				courseId={courseId}
				canModify={canModify}
				isEditing={isEditing}
				disableActions={disableActions}
				onEditToggle={handleEditToggle}
				onDelete={() => setShowDeleteDialog(true)}
			/>
			<CardContent className="space-y-4 border-t border-dashed border-border pt-3">
				{hasRating ? (
					<div className="flex flex-wrap items-center gap-3">
						<RatingMetric
							label="Складність"
							value={difficultyValue}
							valueClassName={getDifficultyTone(rating?.difficulty)}
						/>
						<RatingMetric
							label="Корисність"
							value={usefulnessValue}
							valueClassName={getUsefulnessTone(rating?.usefulness)}
						/>
						<div className="flex items-baseline gap-2">
							<span className="text-xs text-muted-foreground/90">•</span>
							<span className="text-xs text-muted-foreground/90 leading-none relative top-[2px]">
								{rating?.created_at ? `${formatDate(rating.created_at)}` : "—"}
							</span>
						</div>
					</div>
				) : null}

				{actionError ? (
					<p className="text-sm text-destructive" role="alert">
						{actionError}
					</p>
				) : null}

				<RatingCommentDisplay
					comment={comment}
					hasRating={hasRating}
					courseId={courseId}
				/>
			</CardContent>

			<DeleteRatingDialog
				courseId={courseId || ""}
				ratingId={rating?.id || ""}
				open={showDeleteDialog}
				onOpenChange={setShowDeleteDialog}
				onSuccess={onDeleteSuccess}
			/>
		</Card>
	);
}
