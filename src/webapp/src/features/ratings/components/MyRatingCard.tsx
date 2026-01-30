import { useState } from "react";

import { Link } from "@tanstack/react-router";
import { Pencil, Star, Trash2 } from "lucide-react";

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
	const canRate = course.can_rate ?? true;

	const hasRating = Boolean(rating);
	const canModify = Boolean(hasRating && rating?.id && courseId);

	const [showRatingModal, setShowRatingModal] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	return (
		<div
			className={cn(
				"group flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border px-4 py-3 transition-all",
				hasRating
					? "border-border/50 bg-card hover:border-border"
					: canRate
						? "border-l-4 border-l-primary border-y-border/50 border-r-border/50 bg-primary/[0.02] hover:bg-primary/[0.05]"
						: "border-dashed border-border/70 bg-muted/30 opacity-80",
			)}
			data-testid={testIds.myRatings.card}
		>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					{courseId ? (
						<Link
							to="/courses/$courseId"
							params={{ courseId }}
							className="font-medium text-foreground hover:underline decoration-dotted underline-offset-4 truncate"
						>
							{course.course_title ?? "Курс"}
						</Link>
					) : (
						<span className="font-medium text-foreground truncate">
							{course.course_title ?? "Курс"}
						</span>
					)}
					{course.course_code && (
						<span className="text-xs text-muted-foreground shrink-0">
							{course.course_code}
						</span>
					)}
				</div>
			</div>

			{hasRating && rating ? (
				<div className="hidden sm:flex items-center gap-4 text-sm shrink-0">
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

			<div className="flex items-center gap-1 shrink-0">
				{canModify ? (
					<>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setShowRatingModal(true)}
							aria-label="Редагувати оцінку"
							className="size-8 p-0"
						>
							<Pencil className="size-3.5" />
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setShowDeleteDialog(true)}
							aria-label="Видалити оцінку"
							className="size-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
						>
							<Trash2 className="size-3.5" />
						</Button>
					</>
				) : !hasRating && courseId ? (
					canRate ? (
						offeringId ? (
							<Button
								variant="default"
								size="sm"
								className="h-8 px-4 shadow-sm"
								onClick={() => setShowRatingModal(true)}
								data-testid={testIds.myRatings.leaveReviewLink}
							>
								<Star className="size-3.5 mr-1.5 fill-current" />
								Оцінити
							</Button>
						) : (
							<Button
								variant="default"
								size="sm"
								className="h-8 px-4 shadow-sm"
								asChild
							>
								<Link
									to="/courses/$courseId"
									params={{ courseId }}
									search={{ openRating: true }}
									data-testid={testIds.myRatings.leaveReviewLink}
								>
									<Star className="size-3.5 mr-1.5 fill-current" />
									Оцінити
								</Link>
							</Button>
						)
					) : (
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										variant="secondary"
										size="sm"
										disabled
										className="opacity-50 cursor-not-allowed"
									>
										Оцінити
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>
								<p>{CANNOT_RATE_TOOLTIP_TEXT}</p>
							</TooltipContent>
						</Tooltip>
					)
				) : null}
			</div>

			{courseId && offeringId && (
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
