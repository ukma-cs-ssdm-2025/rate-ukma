import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	getDifficultyTone,
	getSemesterDisplay,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import { truncateText } from "@/lib/markdown";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import type { FeedReviewItem as FeedReviewItemType } from "../feedTypes";
import { FeedCard } from "./FeedCard";
import { FeedReviewDialog } from "./FeedReviewDialog";

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
	const [dialogOpen, setDialogOpen] = useState(false);
	const semesterLabel =
		item.semesterYear != null && item.semesterTerm
			? getSemesterDisplay(item.semesterYear, item.semesterTerm)
			: undefined;
	const isBanner = variant === "banner";
	const { truncated, isTruncated } = item.comment
		? truncateText(item.comment, 300, { addEllipsis: true })
		: { truncated: "", isTruncated: false };

	const handleOpenDialog = useCallback(() => {
		setDialogOpen(true);
	}, []);

	// The strip tile has one text line: the review text wins it when there is
	// one, and the scores drop to the meta line in place of the time.
	const tileText = !isBanner && item.comment ? truncated : undefined;
	const scores = (
		<p
			className={cn(
				"flex items-center gap-x-4 leading-none",
				isBanner ? "flex-wrap gap-y-1 text-sm" : "overflow-hidden text-xs",
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
	);
	const meta = (
		<div className="flex flex-col gap-2 text-xs text-muted-foreground">
			{isTruncated && (
				<Button
					onClick={handleOpenDialog}
					variant="ghost"
					size="sm"
					className="h-auto w-fit p-0 text-xs font-medium text-primary"
					data-testid={testIds.feed.readMoreButton}
				>
					Читати більше
				</Button>
			)}
			<div className="flex items-center justify-between gap-2">
				<time className="truncate">{formatRelativeTime(item.createdAt)}</time>
				{semesterLabel && <span className="shrink-0">{semesterLabel}</span>}
			</div>
		</div>
	);

	return (
		<>
			<FeedCard
				variant={variant}
				kind={{ label: "Відгук", icon: MessageSquareText, tone: "primary" }}
				pinned={item.pinned}
				title={
					<Link
						to="/courses/$courseId"
						params={{ courseId: item.courseId }}
						className="underline-offset-4 transition-colors hover:text-primary hover:underline"
					>
						{item.courseTitle}
					</Link>
				}
				footer={tileText ? scores : meta}
			>
				{tileText ?? scores}
				{isBanner && item.comment && (
					<p className="line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
						{truncated}
					</p>
				)}
			</FeedCard>
			<FeedReviewDialog
				item={item}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</>
	);
}
