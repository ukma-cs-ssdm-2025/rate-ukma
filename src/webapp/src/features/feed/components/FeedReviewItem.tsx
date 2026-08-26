import { Link } from "@tanstack/react-router";

import { UserAvatar } from "@/components/UserAvatar";
import {
	getDifficultyTone,
	getSemesterDisplay,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import { cn } from "@/lib/utils";
import type { FeedReviewItem as FeedReviewItemType } from "../feedTypes";

interface FeedReviewItemProps {
	readonly item: FeedReviewItemType;
}

/**
 * Auto-populated feed entry: a compact summary of a recent rating. Kept
 * intentionally quiet (no border, muted meta) so it reads as ambient activity
 * next to the louder promo cards.
 */
export function FeedReviewItem({ item }: FeedReviewItemProps) {
	const semesterLabel =
		item.semesterYear != null && item.semesterTerm
			? getSemesterDisplay(item.semesterYear, item.semesterTerm)
			: undefined;

	return (
		<article className="flex gap-3 py-4">
			<UserAvatar
				name={item.studentName}
				avatarUrl={item.avatarUrl}
				isAnonymous={item.isAnonymous}
				className="h-8 w-8 shrink-0 text-xs font-semibold"
			/>
			<div className="min-w-0 flex-1">
				<p className="text-sm leading-snug">
					<span className="font-medium">{item.studentName}</span>
					<span className="text-muted-foreground"> оцінив(ла) </span>
					<Link
						to="/courses/$courseId"
						params={{ courseId: item.courseId }}
						className="font-medium text-foreground transition-colors hover:text-primary hover:underline"
					>
						{item.courseTitle}
					</Link>
				</p>

				<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
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
					</span>
				</div>

				{item.comment && (
					<p className="mt-2.5 line-clamp-2 text-sm text-muted-foreground">
						{item.comment}
					</p>
				)}

				<div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
					<time>{formatRelativeTime(item.createdAt)}</time>
					{semesterLabel && (
						<>
							<span aria-hidden>·</span>
							<span>{semesterLabel}</span>
						</>
					)}
				</div>
			</div>
		</article>
	);
}
