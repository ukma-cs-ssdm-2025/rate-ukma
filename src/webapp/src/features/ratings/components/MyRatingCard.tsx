import { useState } from "react";

import { Link } from "@tanstack/react-router";
import { PenLine, Pencil, Trash2 } from "lucide-react";

import { DisabledButtonWithTooltip } from "@/components/DisabledButtonWithTooltip";
import { Button } from "@/components/ui/Button";
import { ExpandableText } from "@/components/ui/ExpandableText";
import {
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import { CANNOT_RATE_TOOLTIP_TEXT } from "@/features/ratings/definitions/ratingDefinitions";
import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { DeleteRatingDialog } from "./DeleteRatingDialog";
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
	const canRate = Boolean(course.can_rate);

	const hasRating = Boolean(rating);
	const canModify = Boolean(hasRating && rating?.id && courseId);

	const [showRatingModal, setShowRatingModal] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	return (
		<div
			className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-muted/50 px-4 py-3"
			data-testid={testIds.myRatings.card}
		>
			<div className="min-w-0 flex-1 basis-40 space-y-1">
				{courseId ? (
					<Link
						to="/courses/$courseId"
						params={{ courseId }}
						className="line-clamp-2 font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
						data-testid={testIds.myRatings.courseTitleLink}
					>
						{course.course_title ?? "Курс"}
					</Link>
				) : (
					<span className="line-clamp-2 font-medium text-foreground">
						{course.course_title ?? "Курс"}
					</span>
				)}
				{rating?.comment?.trim() ? (
					<ExpandableText
						lines={2}
						className="text-sm whitespace-pre-wrap text-muted-foreground"
					>
						{rating.comment}
					</ExpandableText>
				) : null}
				{/* Without an excerpt a scores-only rating reads the same as a written one. */}
				{rating && !rating.comment?.trim() && canModify ? (
					<button
						type="button"
						onClick={() => setShowRatingModal(true)}
						className="text-sm text-primary underline-offset-4 hover:underline"
					>
						Додати текстовий відгук
					</button>
				) : null}
			</div>

			<div className="ml-auto flex shrink-0 items-center gap-4">
				{rating ? (
					<div className="flex items-center gap-4 text-sm">
						<span className="text-muted-foreground">
							Складність{" "}
							<span
								className={cn(
									"font-semibold tabular-nums",
									getDifficultyTone(rating.difficulty),
								)}
							>
								{rating.difficulty?.toFixed(1) ?? "—"}
							</span>
						</span>
						<span className="text-muted-foreground">
							Корисність{" "}
							<span
								className={cn(
									"font-semibold tabular-nums",
									getUsefulnessTone(rating.usefulness),
								)}
							>
								{rating.usefulness?.toFixed(1) ?? "—"}
							</span>
						</span>
					</div>
				) : null}
				<div className="flex items-center gap-1">
					<CardActions
						canModify={canModify}
						hasRating={hasRating}
						courseId={courseId}
						offeringId={offeringId}
						canRate={canRate}
						onEdit={() => setShowRatingModal(true)}
						onDelete={() => setShowDeleteDialog(true)}
					/>
				</div>
			</div>

			{courseId && (offeringId || canModify) && (
				<RatingModal
					isOpen={showRatingModal}
					onClose={() => setShowRatingModal(false)}
					courseId={courseId}
					offeringId={offeringId}
					courseName={course.course_title}
					existingRating={rating}
					onSuccess={onRatingChanged}
				/>
			)}

			{courseId && rating?.id && (
				<DeleteRatingDialog
					courseId={courseId}
					ratingId={rating.id}
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
					onSuccess={onRatingChanged}
				/>
			)}
		</div>
	);
}

interface CardActionsProps {
	canModify: boolean;
	hasRating: boolean;
	courseId: string | undefined;
	offeringId: string | undefined;
	canRate: boolean;
	onEdit: () => void;
	onDelete: () => void;
}

function CardActions({
	canModify,
	hasRating,
	courseId,
	offeringId,
	canRate,
	onEdit,
	onDelete,
}: Readonly<CardActionsProps>) {
	if (canModify) {
		return (
			<>
				<Button
					size="icon-sm"
					variant="ghost"
					onClick={onEdit}
					aria-label="Редагувати оцінку"
					className="text-muted-foreground hover:text-foreground"
					data-testid={testIds.myRatings.editButton}
				>
					<Pencil className="size-4" />
				</Button>
				<Button
					size="icon-sm"
					variant="ghost"
					onClick={onDelete}
					aria-label="Видалити оцінку"
					className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
					data-testid={testIds.myRatings.deleteButton}
				>
					<Trash2 className="size-4" />
				</Button>
			</>
		);
	}

	if (hasRating || !courseId) {
		return null;
	}

	if (!canRate) {
		return (
			<DisabledButtonWithTooltip reason={CANNOT_RATE_TOOLTIP_TEXT}>
				<Button
					variant="secondary"
					size="sm"
					className="min-h-10 cursor-not-allowed px-4 opacity-50 hover:bg-secondary sm:min-h-0"
				>
					<PenLine className="size-3.5" />
					Оцінити
				</Button>
			</DisabledButtonWithTooltip>
		);
	}

	if (offeringId) {
		return (
			<Button
				size="sm"
				onClick={onEdit}
				className="min-h-10 px-4 sm:min-h-0"
				data-testid={testIds.myRatings.leaveReviewLink}
			>
				<PenLine className="size-3.5" />
				Оцінити
			</Button>
		);
	}
	return (
		<Button size="sm" className="min-h-10 px-4 sm:min-h-0" asChild>
			<Link
				to="/courses/$courseId"
				params={{ courseId }}
				search={{ openRating: true }}
				data-testid={testIds.myRatings.leaveReviewLink}
			>
				<PenLine className="size-3.5" />
				Оцінити
			</Link>
		</Button>
	);
}
