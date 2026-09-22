import { useMemo } from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { CircularProgress } from "@/components/ui/CircularProgress";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import {
	getCurrentSemester,
	isCurrentSemester,
	isFutureSemester,
} from "@/features/courses/courseFormatting";
import { CANNOT_RATE_TOOLTIP_TEXT } from "@/features/ratings/definitions/ratingDefinitions";
import type { SemesterGroup } from "@/features/ratings/groupRatings";
import { testIds } from "@/lib/test-ids";
import { MyRatingCard } from "./MyRatingCard";

interface MyRatingsSemesterSectionProps {
	seasonGroup: SemesterGroup;
	onRatingChanged: () => undefined | Promise<unknown>;
	isOpen?: boolean;
	onToggle: (open: boolean) => void;
}

export function MyRatingsSemesterSection({
	seasonGroup,
	onRatingChanged,
	isOpen: controlledIsOpen,
	onToggle,
}: Readonly<MyRatingsSemesterSectionProps>) {
	const currentSemester = useMemo(() => getCurrentSemester(), []);

	const { year, seasonRaw } = seasonGroup;

	const isCurrent =
		year != null &&
		seasonRaw != null &&
		isCurrentSemester({ year, season: seasonRaw }, currentSemester);
	const isFuture =
		year != null &&
		seasonRaw != null &&
		isFutureSemester({ year, season: seasonRaw }, currentSemester);

	const isOpen = controlledIsOpen ?? isCurrent;

	const percentage =
		seasonGroup.totalCount > 0
			? Math.round((seasonGroup.ratedCount / seasonGroup.totalCount) * 100)
			: 0;

	const hasRateableCourses = seasonGroup.unratedRateableCount > 0;
	const hasUnratedButNotRateable = seasonGroup.items.some(
		(item) => !item.rated && !item.can_rate,
	);

	const sortedItems = useMemo(() => {
		return [...seasonGroup.items].sort((a, b) => {
			return (a.course_title ?? "").localeCompare(b.course_title ?? "");
		});
	}, [seasonGroup.items]);

	return (
		<Collapsible open={isOpen} onOpenChange={onToggle}>
			<CollapsibleTrigger
				className="group flex w-full cursor-pointer items-center justify-between rounded-md px-1 py-2 text-left transition-colors hover:bg-muted/50"
				data-testid={testIds.myRatings.semesterTrigger}
			>
				<div className="flex min-w-0 items-center gap-2">
					{isOpen ? (
						<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
					) : (
						<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
					)}
					<span className="truncate font-medium text-foreground">
						{seasonGroup.label}
					</span>
				</div>

				<SemesterBadges
					percentage={percentage}
					unratedRateableCount={seasonGroup.unratedRateableCount}
					hasRateableCourses={hasRateableCourses}
					hasUnratedButNotRateable={hasUnratedButNotRateable}
					isFuture={isFuture}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="space-y-2 pt-2 pl-6">
					{sortedItems.map((course, index) => (
						<MyRatingCard
							key={
								course.course_offering_id ??
								course.course_id ??
								`${seasonGroup.key}-${index}`
							}
							course={course}
							onRatingChanged={onRatingChanged}
						/>
					))}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

interface SemesterBadgesProps {
	percentage: number;
	unratedRateableCount: number;
	hasRateableCourses: boolean;
	hasUnratedButNotRateable: boolean;
	isFuture: boolean;
}

function SemesterBadges({
	percentage,
	unratedRateableCount,
	hasRateableCourses,
	hasUnratedButNotRateable,
	isFuture,
}: Readonly<SemesterBadgesProps>) {
	return (
		<div className="flex shrink-0 items-center gap-2 px-1">
			{percentage < 100 && unratedRateableCount > 0 && (
				<div className="flex items-center gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
					<CircularProgress value={percentage} size={14} strokeWidth={2.5} />
					<span className="text-xs font-medium text-muted-foreground">
						{percentage}%
					</span>
				</div>
			)}
			{unratedRateableCount > 0 && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge variant="soft" className="cursor-help">
							Ще {unratedRateableCount} оцінити
						</Badge>
					</TooltipTrigger>
					<TooltipContent side="top">
						Твої оцінки допоможуть іншим студентам зробити кращий вибір
					</TooltipContent>
				</Tooltip>
			)}
			{percentage === 100 && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge variant="success" className="cursor-default">
							Все оцінено
						</Badge>
					</TooltipTrigger>
					<TooltipContent side="top">
						Дякуємо, що оцінили всі курси цього семестру!
					</TooltipContent>
				</Tooltip>
			)}
			{!hasRateableCourses && hasUnratedButNotRateable && !isFuture && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge variant="outline" className="cursor-help">
							Оцінювання невдовзі
						</Badge>
					</TooltipTrigger>
					<TooltipContent side="top">{CANNOT_RATE_TOOLTIP_TEXT}</TooltipContent>
				</Tooltip>
			)}
			{isFuture && <Badge variant="outline">Ще не розпочався</Badge>}
		</div>
	);
}
