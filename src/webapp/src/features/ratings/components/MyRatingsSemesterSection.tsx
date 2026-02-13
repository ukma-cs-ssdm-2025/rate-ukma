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
import type { SemesterGroup } from "@/features/ratings/groupRatings";
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
			<CollapsibleTrigger className="group flex items-center justify-between py-2 w-full hover:bg-muted/50 rounded-md transition-colors cursor-pointer text-left px-1">
				<div className="flex items-center gap-2 min-w-0">
					{isOpen ? (
						<ChevronDown className="size-4 text-muted-foreground shrink-0" />
					) : (
						<ChevronRight className="size-4 text-muted-foreground shrink-0" />
					)}
					<span className="font-medium text-foreground truncate">
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
		<div className="flex items-center gap-3 shrink-0 px-1">
			<div className="flex items-center gap-2">
				{percentage < 100 && unratedRateableCount > 0 && (
					<div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
						<CircularProgress value={percentage} size={14} strokeWidth={2.5} />
						<span className="text-[10px] text-muted-foreground font-medium">
							{percentage}%
						</span>
					</div>
				)}
				{unratedRateableCount > 0 && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge
								variant="secondary"
								className="h-5 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-help"
							>
								Ще {unratedRateableCount} оцінити
							</Badge>
						</TooltipTrigger>
						<TooltipContent side="top" className="text-[11px] px-2 py-1">
							Твої оцінки допоможуть іншим студентам зробити кращий вибір
						</TooltipContent>
					</Tooltip>
				)}
				{percentage === 100 && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge
								variant="outline"
								className="h-5 px-1.5 text-[10px] text-green-600 border-green-200 bg-green-50/30 cursor-default"
							>
								Все оцінено
							</Badge>
						</TooltipTrigger>
						<TooltipContent side="top" className="text-[11px] px-2 py-1">
							Дякуємо, що оцінили всі курси цього семестру!
						</TooltipContent>
					</Tooltip>
				)}
				{!hasRateableCourses && hasUnratedButNotRateable && !isFuture && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge
								variant="outline"
								className="h-5 px-1.5 text-[10px] text-muted-foreground border-muted-foreground/20 bg-muted/5 cursor-help"
							>
								Оцінювання невдовзі
							</Badge>
						</TooltipTrigger>
						<TooltipContent side="top" className="text-[11px] px-2 py-1">
							Оцінювання стане доступним з середини семестру
						</TooltipContent>
					</Tooltip>
				)}
			</div>
			{isFuture && (
				<Badge
					variant="outline"
					className="h-5 px-1.5 text-[10px] text-muted-foreground border-muted-foreground/20 bg-muted/5"
				>
					Ще не розпочався
				</Badge>
			)}
		</div>
	);
}
