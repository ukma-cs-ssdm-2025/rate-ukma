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

/** A recent rating; anonymous in the feed. */
export function FeedReviewItem({
	item,
	variant = "card",
}: Readonly<FeedReviewItemProps>) {
	const semesterLabel =
		item.semesterYear != null && item.semesterTerm
			? getSemesterDisplay(item.semesterYear, item.semesterTerm)
			: undefined;
	const isBanner = variant === "banner";

	if (!isBanner) {
		return (
			<FeedCard
				variant="card"
				badge={<Badge variant="soft">Відгук</Badge>}
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
					<p className="truncate text-xs text-muted-foreground">
						<time>{formatRelativeTime(item.createdAt)}</time>
						{semesterLabel && <span>, {semesterLabel}</span>}
					</p>
				}
			>
				<p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
					<span className="inline-flex items-center gap-1 whitespace-nowrap">
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
					<span className="inline-flex items-center gap-1 whitespace-nowrap">
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
					<p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
						{item.comment}
					</p>
				)}
			</FeedCard>
		);
	}

	return (
		<FeedCard
			variant="banner"
			badge={<Badge variant="soft">Відгук</Badge>}
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
				<div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
					<time>{formatRelativeTime(item.createdAt)}</time>
					{semesterLabel && <span>{semesterLabel}</span>}
				</div>
			}
		>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
				<span className="flex items-center gap-1">
					<span className="text-muted-foreground">Складність</span>
					<span
						className={cn(
							"font-semibold tabular-nums",
							getDifficultyTone(item.difficulty),
						)}
					>
						{item.difficulty.toFixed(1)}
					</span>
					<ComparisonArrow
						score={item.difficulty}
						average={item.courseAvgDifficulty}
					/>
				</span>
				<span className="flex items-center gap-1">
					<span className="text-muted-foreground">Корисність</span>
					<span
						className={cn(
							"font-semibold tabular-nums",
							getUsefulnessTone(item.usefulness),
						)}
					>
						{item.usefulness.toFixed(1)}
					</span>
					<ComparisonArrow
						score={item.usefulness}
						average={item.courseAvgUsefulness}
					/>
				</span>
			</div>

			{item.comment && (
				<p className="line-clamp-2 text-sm text-muted-foreground">
					{item.comment}
				</p>
			)}
		</FeedCard>
	);
}
