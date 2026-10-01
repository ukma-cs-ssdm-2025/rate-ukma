import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import {
	getDifficultyTone,
	getSemesterDisplay,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import { cn } from "@/lib/utils";
import { testIds } from "@/lib/test-ids";
import type { FeedReviewItem } from "../feedTypes";

interface FeedReviewDialogProps {
	readonly item: FeedReviewItem;
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
}

const TIE_EPSILON = 0.05;

function ComparisonArrow({
	score,
	average,
}: {
	readonly score: number;
	readonly average: number;
}) {
	const delta = score - average;
	if (Math.abs(delta) < TIE_EPSILON) return null;

	const Icon = delta > 0 ? ArrowUp : ArrowDown;
	const label = `${delta > 0 ? "вище" : "нижче"} за середнє (${average.toFixed(1)})`;

	return (
		<Icon
			className="inline size-3 align-baseline text-muted-foreground"
			aria-label={label}
		/>
	);
}

export function FeedReviewDialog({
	item,
	open,
	onOpenChange,
}: Readonly<FeedReviewDialogProps>) {
	const semesterLabel =
		item.semesterYear != null && item.semesterTerm
			? getSemesterDisplay(item.semesterYear, item.semesterTerm)
			: undefined;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
				data-testid={testIds.feed.reviewDialog}
			>
				<DialogHeader>
					<DialogTitle className="leading-tight tracking-tight">
						<Link
							to="/courses/$courseId"
							params={{ courseId: item.courseId }}
							className="underline-offset-4 transition-colors hover:text-primary hover:underline"
						>
							{item.courseTitle}
						</Link>
					</DialogTitle>
					<div className="flex flex-wrap gap-2 pt-2">
						<Badge variant="outline">
							<span className="text-muted-foreground">Складність</span>{" "}
							<span
								className={cn(
									"ml-1 font-semibold tabular-nums",
									getDifficultyTone(item.difficulty),
								)}
							>
								{item.difficulty.toFixed(1)}
							</span>{" "}
							<ComparisonArrow
								score={item.difficulty}
								average={item.courseAvgDifficulty}
							/>
						</Badge>
						<Badge variant="outline">
							<span className="text-muted-foreground">Корисність</span>{" "}
							<span
								className={cn(
									"ml-1 font-semibold tabular-nums",
									getUsefulnessTone(item.usefulness),
								)}
							>
								{item.usefulness.toFixed(1)}
							</span>{" "}
							<ComparisonArrow
								score={item.usefulness}
								average={item.courseAvgUsefulness}
							/>
						</Badge>
						{semesterLabel && <Badge variant="outline">{semesterLabel}</Badge>}
					</div>
				</DialogHeader>

				{item.comment && (
					<DialogDescription asChild>
						<p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
							{item.comment}
						</p>
					</DialogDescription>
				)}

				<div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
					<time>{formatRelativeTime(item.createdAt)}</time>
				</div>
			</DialogContent>
		</Dialog>
	);
}
