import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import {
	getDifficultyTone,
	getSemesterDisplay,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import { cn } from "@/lib/utils";
import type { FeedReviewItem as FeedReviewItemType } from "../feedTypes";
import { FeedCard } from "./FeedCard";

interface FeedReviewItemProps {
	readonly item: FeedReviewItemType;
	readonly variant?: "card" | "banner";
}

/** Ties render nothing; the epsilon keeps float noise from reading as a difference. */
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

/**
 * A recent rating; anonymous in the feed. Scans as course → scores → text →
 * meta, mirroring the course page review cards (RatingStats + RatingComment).
 */
export function FeedReviewItem({
	item,
	variant = "card",
}: Readonly<FeedReviewItemProps>) {
	const semesterLabel =
		item.semesterYear != null && item.semesterTerm
			? getSemesterDisplay(item.semesterYear, item.semesterTerm)
			: undefined;
	const isBanner = variant === "banner";

	return (
		<FeedCard
			variant={variant}
			pinned={item.pinned}
			title={
				<Link
					to="/courses/$courseId"
					params={{ courseId: item.courseId }}
					className="transition-colors hover:text-primary hover:underline"
				>
					{item.courseTitle}
				</Link>
			}
			footer={
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
					<Badge variant="soft">Відгук</Badge>
					<time className="truncate">{formatRelativeTime(item.createdAt)}</time>
					{semesterLabel && (
						<span className="ml-auto shrink-0">{semesterLabel}</span>
					)}
				</div>
			}
		>
			<p
				className={cn(
					"flex flex-wrap items-center gap-x-4 gap-y-1 leading-none",
					isBanner ? "text-sm" : "text-xs",
				)}
			>
				<span className="flex items-center gap-1.5 whitespace-nowrap">
					<span className="text-muted-foreground">Складність</span>{" "}
					<span
						className={cn(
							"font-semibold tabular-nums",
							getDifficultyTone(item.difficulty),
						)}
					>
						{item.difficulty.toFixed(1)}
					</span>{" "}
					<ComparisonArrow
						score={item.difficulty}
						average={item.courseAvgDifficulty}
					/>
				</span>
				<span className="flex items-center gap-1.5 whitespace-nowrap">
					<span className="text-muted-foreground">Корисність</span>{" "}
					<span
						className={cn(
							"font-semibold tabular-nums",
							getUsefulnessTone(item.usefulness),
						)}
					>
						{item.usefulness.toFixed(1)}
					</span>{" "}
					<ComparisonArrow
						score={item.usefulness}
						average={item.courseAvgUsefulness}
					/>
				</span>
			</p>
			{item.comment && (
				<p
					className={
						isBanner
							? "line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90"
							: "line-clamp-2 flex-1 text-sm text-muted-foreground"
					}
				>
					{item.comment}
				</p>
			)}
		</FeedCard>
	);
}
