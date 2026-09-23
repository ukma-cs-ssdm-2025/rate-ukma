import { useState } from "react";

import { Link } from "@tanstack/react-router";
import { Pencil, PenLine, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
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
			className="flex items-center gap-3 py-3"
			data-testid={testIds.myRatings.card}
		>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-2">
					{courseId ? (
						<Link
							to="/courses/$courseId"
							params={{ courseId }}
							className="truncate font-medium text-foreground underline-offset-4 decoration-dotted hover:underline"
							data-testid={testIds.myRatings.courseTitleLink}
						>
							{course.course_title ?? "Курс"}
						</Link>
					) : (
						<span className="truncate font-medium text-foreground">
							{course.course_title ?? "Курс"}
						</span>
					)}
				</div>
				{hasRating && rating ? (
					<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
						<span className="text-muted-foreground">
							Складність{" "}
							<span
								className={cn(
									"font-semibold",
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
									"font-semibold",
									getUsefulnessTone(rating.usefulness),
								)}
							>
								{rating.usefulness?.toFixed(1) ?? "—"}
							</span>
						</span>
					</div>
				) : null}
			</div>

			<div className="flex shrink-0 items-center gap-1">
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
					data-testid={testIds.myRatings.editButton}
				>
					<Pencil className="size-3.5" />
				</Button>
				<Button
					size="icon-sm"
					variant="ghost"
					onClick={onDelete}
					aria-label="Видалити оцінку"
					className="text-destructive hover:text-destructive hover:bg-destructive/10"
					data-testid={testIds.myRatings.deleteButton}
				>
					<Trash2 className="size-3.5" />
				</Button>
			</>
		);
	}

	if (hasRating || !courseId) {
		return null;
	}

	if (!canRate) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="inline-block" tabIndex={0}>
						<Button variant="secondary" size="sm" disabled>
							<PenLine className="size-3.5" />
							Оцінити
						</Button>
					</span>
				</TooltipTrigger>
				<TooltipContent>
					<p>{CANNOT_RATE_TOOLTIP_TEXT}</p>
				</TooltipContent>
			</Tooltip>
		);
	}

	if (offeringId) {
		return (
			<Button
				variant="default"
				size="sm"
				onClick={onEdit}
				data-testid={testIds.myRatings.leaveReviewLink}
			>
				<PenLine className="size-3.5" />
				Оцінити
			</Button>
		);
	}
	return (
		<Button variant="default" size="sm" asChild>
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
