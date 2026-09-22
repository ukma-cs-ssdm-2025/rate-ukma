import { useState } from "react";

import { Link } from "@tanstack/react-router";
import { Pencil, PenLine, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
import { getFacultyAccent, type FacultyAccent } from "@/lib/faculty-colors";
import { useFeatureFlag } from "@/lib/feature-flags/useFeatureFlag";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { DeleteRatingDialog } from "./DeleteRatingDialog";
import { RatingModal } from "./RatingModal";

interface MyRatingCardProps {
	course: StudentRatingsDetailed;
	onRatingChanged: () => undefined | Promise<unknown>;
}
function getCardClassName(hasRating: boolean, canRate: boolean): string {
	if (hasRating || canRate) {
		return "shadow-sm";
	}
	return "border-dashed bg-muted/30 opacity-80 shadow-none";
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
	const showFacultyColors = useFeatureFlag("fe_faculty_colors");
	const accent = showFacultyColors
		? getFacultyAccent(course.faculty_name)
		: null;

	const [showRatingModal, setShowRatingModal] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	return (
		<Card
			className={cn(
				"flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center",
				accent && "border-l-4",
				getCardClassName(hasRating, canRate),
			)}
			style={accent ? { borderLeftColor: accent.background } : undefined}
			data-testid={testIds.myRatings.card}
		>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
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
					{course.course_code && (
						<span className="shrink-0 text-xs text-muted-foreground">
							{course.course_code}
						</span>
					)}
				</div>
			</div>

			{hasRating && rating ? (
				<div className="hidden shrink-0 items-center gap-4 text-sm sm:flex">
					<div className="flex items-center gap-1.5">
						<span className="text-xs text-muted-foreground">Складність</span>
						<span
							className={cn(
								"font-semibold",
								getDifficultyTone(rating.difficulty),
							)}
						>
							{rating.difficulty?.toFixed(1) ?? "—"}
						</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="text-xs text-muted-foreground">Корисність</span>
						<span
							className={cn(
								"font-semibold",
								getUsefulnessTone(rating.usefulness),
							)}
						>
							{rating.usefulness?.toFixed(1) ?? "—"}
						</span>
					</div>
				</div>
			) : null}

			<div className="flex shrink-0 items-center gap-1">
				<CardActions
					canModify={canModify}
					hasRating={hasRating}
					courseId={courseId}
					offeringId={offeringId}
					canRate={canRate}
					accent={accent}
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
		</Card>
	);
}

interface CardActionsProps {
	canModify: boolean;
	hasRating: boolean;
	courseId: string | undefined;
	offeringId: string | undefined;
	canRate: boolean;
	accent: FacultyAccent | null;
	onEdit: () => void;
	onDelete: () => void;
}

function CardActions({
	canModify,
	hasRating,
	courseId,
	offeringId,
	canRate,
	accent,
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
						<Button
							variant="secondary"
							size="sm"
							disabled
							style={
								accent
									? {
											backgroundColor: accent.background,
											color: accent.foreground,
										}
									: undefined
							}
						>
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
				className={cn(accent && "hover:brightness-90")}
				style={
					accent
						? { backgroundColor: accent.background, color: accent.foreground }
						: undefined
				}
				onClick={onEdit}
				data-testid={testIds.myRatings.leaveReviewLink}
			>
				<PenLine className="size-3.5" />
				Оцінити
			</Button>
		);
	}
	return (
		<Button
			variant="default"
			size="sm"
			className={cn(accent && "hover:brightness-90")}
			style={
				accent
					? { backgroundColor: accent.background, color: accent.foreground }
					: undefined
			}
			asChild
		>
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
