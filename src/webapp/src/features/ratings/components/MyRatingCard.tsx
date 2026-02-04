import { useState } from "react";

import { Card, CardContent } from "@/components/ui/Card";
import {
	formatDate,
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { DeleteRatingDialog } from "./DeleteRatingDialog";
import { RatingCardHeader } from "./MyRatingCard/RatingCardHeader";
import { RatingCommentDisplay } from "./MyRatingCard/RatingCommentDisplay";
import { RatingMetric } from "./MyRatingCard/RatingMetric";
import { RatingModal } from "./RatingModal";

interface MyRatingCardProps {
	course: StudentRatingsDetailed;
	onRatingChanged: () => undefined | Promise<unknown>;
}

export function MyRatingCard({
	course,
	onRatingChanged,
}: Readonly<MyRatingCardProps>) {
	const courseId = course.course_id;
	const offeringId = course.course_offering_id;
	const rating = course.rated ?? null;
	const disableActions = false;

	const difficultyValue =
		typeof rating?.difficulty === "number" ? rating.difficulty.toFixed(1) : "—";
	const usefulnessValue =
		typeof rating?.usefulness === "number" ? rating.usefulness.toFixed(1) : "—";
	const comment = rating?.comment?.trim();
	const hasRating = Boolean(rating);
	const canModify = Boolean(hasRating && rating?.id && courseId);

	const [showRatingModal, setShowRatingModal] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const onDeleteSuccess = () => {
		onRatingChanged();
	};

	const handleEditClick = () => {
		setShowRatingModal(true);
	};

	const handleRatingModalClose = () => {
		setShowRatingModal(false);
	};

	const handleRatingSuccess = () => {
		onRatingChanged();
	};

	return (
		<Card
			className="border border-border/70 bg-background/80 transition-shadow duration-300 hover:shadow-xl"
			data-testid={testIds.myRatings.card}
		>
			<RatingCardHeader
				courseTitle={course.course_title}
				courseCode={course.course_code ?? undefined}
				courseId={courseId}
				canModify={canModify}
				isEditing={showRatingModal}
				disableActions={disableActions}
				onEditToggle={handleEditClick}
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
						<div className="flex items-baseline gap-2">
							<span className="text-xs text-muted-foreground/90">•</span>
							<span className="text-xs text-muted-foreground/90 leading-none relative top-[2px]">
								Відгук залишено:{" "}
								{rating?.is_anonymous ? "Анонімно" : "Не анонімно"}
							</span>
						</div>
					</div>
				) : null}

				<RatingCommentDisplay
					comment={comment}
					hasRating={hasRating}
					courseId={courseId}
					canRate={course.can_rate ?? true}
				/>
			</CardContent>

			{courseId && offeringId && (
				<RatingModal
					isOpen={showRatingModal}
					onClose={handleRatingModalClose}
					courseId={courseId}
					offeringId={offeringId}
					courseName={course.course_title}
					existingRating={rating}
					onSuccess={handleRatingSuccess}
				/>
			)}

			{courseId && rating?.id && (
				<DeleteRatingDialog
					courseId={courseId}
					ratingId={rating.id}
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
					onSuccess={onDeleteSuccess}
				/>
			)}
		</Card>
	);
}
