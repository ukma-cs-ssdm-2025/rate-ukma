import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, MessageSquareText } from "lucide-react";

import {
	getDifficultyTone,
	getSemesterDisplay,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import { cn } from "@/lib/utils";
import type { FeedReviewItem as FeedReviewItemData } from "@/lib/api/generated";
import { FeedCard } from "./FeedCard";

interface FeedReviewItemProps {
	readonly item: FeedReviewItemData;
	readonly variant?: "card" | "banner";
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
	if (Math.abs(delta) < TIE_EPSILON) {
		return null;
	}

	const Icon = delta > 0 ? ArrowUp : ArrowDown;
	const label = `${delta > 0 ? "вище" : "нижче"} за середнє (${average.toFixed(1)})`;

	return (
		<Icon
			className="inline size-3 align-baseline text-muted-foreground"
			aria-label={label}
		/>
	);
}

export function FeedReviewItem({
	item,
	variant = "card",
}: Readonly<FeedReviewItemProps>) {
	const semesterLabel = getSemesterDisplay(
		item.semester_year,
		item.semester_term,
	);
	const isBanner = variant === "banner";
	const tileText = !isBanner && item.comment ? item.comment : undefined;
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
					average={item.course_avg_difficulty}
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
					average={item.course_avg_usefulness}
				/>
			</span>
		</p>
	);
	const meta = (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
			<time className="truncate">{formatRelativeTime(item.occurred_at)}</time>
			{semesterLabel && (
				<span className="ml-auto shrink-0">{semesterLabel}</span>
			)}
		</div>
	);

	return (
		<FeedCard
			variant={variant}
			kind={{ label: "Відгук", icon: MessageSquareText, tone: "primary" }}
			title={
				<Link
					to="/courses/$courseId"
					params={{ courseId: item.course_id }}
					className="underline-offset-4 transition-colors hover:text-primary hover:underline"
				>
					{item.course_title}
				</Link>
			}
			footer={tileText ? scores : meta}
		>
			{tileText ?? scores}
			{isBanner && item.comment && (
				<p className="line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
					{item.comment}
				</p>
			)}
		</FeedCard>
	);
}
