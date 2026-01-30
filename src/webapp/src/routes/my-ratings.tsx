import { type ReactNode, useCallback, useMemo, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";

import Layout from "@/components/Layout";
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
	getSemesterTermDisplay,
	isCurrentSemester,
	isFutureSemester,
} from "@/features/courses/courseFormatting";
import { MyRatingCard } from "@/features/ratings/components/MyRatingCard";
import { MyRatingsEmptyState } from "@/features/ratings/components/MyRatingsEmptyState";
import { MyRatingsErrorState } from "@/features/ratings/components/MyRatingsErrorState";
import {
	MyRatingsHeader,
	type RatingFilter,
} from "@/features/ratings/components/MyRatingsHeader";
import { MyRatingsNotStudentState } from "@/features/ratings/components/MyRatingsNotStudentState";
import { MyRatingsSkeleton } from "@/features/ratings/components/MyRatingsSkeleton";
import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { useStudentsMeGradesRetrieve } from "@/lib/api/generated";
import { useAuth, withAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";

const COLLAPSIBLE_STATE_KEY = "my-ratings-collapsible-state";

function MyRatings() {
	const { isStudent } = useAuth();
	const [filter, setFilter] = useState<RatingFilter>("all");

	const { data, isLoading, isFetching, error, refetch } =
		useStudentsMeGradesRetrieve({
			query: {
				enabled: isStudent,
			},
		});

	const ratings = useMemo<StudentRatingsDetailed[]>(() => {
		if (!data) {
			return [];
		}
		return Array.isArray(data) ? data : [data];
	}, [data]);

	const ratedCourses = useMemo(
		() => ratings.filter((course) => Boolean(course.rated)).length,
		[ratings],
	);

	const totalCourses = ratings.length;
	const isRefetching = isFetching && !isLoading;
	const groupedRatings = useMemo(
		() => groupRatingsByYearAndSemester(ratings, filter),
		[ratings, filter],
	);

	const [collapsedState, setCollapsedState] = useState<Record<string, boolean>>(
		() => {
			const saved = localStorage.getItem(COLLAPSIBLE_STATE_KEY);
			return saved ? JSON.parse(saved) : {};
		},
	);

	const updateCollapsedState = useCallback((key: string, isOpen: boolean) => {
		setCollapsedState((prev) => {
			const newState = { ...prev, [key]: isOpen };
			localStorage.setItem(COLLAPSIBLE_STATE_KEY, JSON.stringify(newState));
			return newState;
		});
	}, []);

	const toggleAll = useCallback(
		(open: boolean) => {
			const newState: Record<string, boolean> = {};
			for (const yearGroup of groupedRatings) {
				for (const season of yearGroup.seasons) {
					newState[season.key] = open;
				}
			}
			setCollapsedState(newState);
			localStorage.setItem(COLLAPSIBLE_STATE_KEY, JSON.stringify(newState));
		},
		[groupedRatings],
	);

	const isAllExpanded = useMemo(() => {
		const totalKeys = groupedRatings.reduce(
			(acc, year) => acc + year.seasons.length,
			0,
		);
		if (totalKeys === 0) return false;
		const openKeys = Object.values(collapsedState).filter(Boolean).length;
		return openKeys === totalKeys;
	}, [groupedRatings, collapsedState]);

	const handleToggleExpandAll = useCallback(() => {
		toggleAll(!isAllExpanded);
	}, [toggleAll, isAllExpanded]);

	let content: ReactNode;

	if (!isStudent) {
		content = <MyRatingsNotStudentState />;
	} else if (isLoading) {
		content = <MyRatingsSkeleton />;
	} else if (error) {
		content = (
			<MyRatingsErrorState onRetry={refetch} isRetrying={isRefetching} />
		);
	} else if (totalCourses === 0) {
		content = <MyRatingsEmptyState />;
	} else if (groupedRatings.length === 0 && filter !== "all") {
		content = (
			<div className="text-center py-12">
				<p className="text-muted-foreground">
					{filter === "unrated" && "Всі курси оцінено! 🎉"}
					{filter === "rated" && "Ви ще не оцінили жодного курсу"}
				</p>
			</div>
		);
	} else {
		content = (
			<div className="space-y-8" data-testid={testIds.myRatings.list}>
				{groupedRatings.map((yearGroup) => (
					<YearGroupSection
						key={yearGroup.key}
						yearGroup={yearGroup}
						onRatingChanged={refetch}
						collapsedState={collapsedState}
						onToggle={updateCollapsedState}
					/>
				))}
			</div>
		);
	}

	return (
		<Layout>
			<div className="space-y-6">
				<MyRatingsHeader
					totalCourses={totalCourses}
					ratedCourses={ratedCourses}
					isLoading={isLoading}
					filter={filter}
					onFilterChange={setFilter}
					isAllExpanded={isAllExpanded}
					onToggleExpandAll={handleToggleExpandAll}
				/>
				{content}
			</div>
		</Layout>
	);
}

interface YearGroupSectionProps {
	yearGroup: YearGroup;
	onRatingChanged: () => undefined | Promise<unknown>;
	collapsedState: Record<string, boolean>;
	onToggle: (key: string, isOpen: boolean) => void;
}

function YearGroupSection({
	yearGroup,
	onRatingChanged,
	collapsedState,
	onToggle,
}: Readonly<YearGroupSectionProps>) {
	return (
		<div className="space-y-3">
			<h2 className="text-xl font-semibold text-foreground">
				{yearGroup.label}
			</h2>

			<div className="space-y-1">
				{yearGroup.seasons.map((seasonGroup) => (
					<SemesterSection
						key={seasonGroup.key}
						seasonGroup={seasonGroup}
						onRatingChanged={onRatingChanged}
						isOpen={collapsedState[seasonGroup.key]}
						onToggle={(open) => onToggle(seasonGroup.key, open)}
					/>
				))}
			</div>
		</div>
	);
}

interface SemesterSectionProps {
	seasonGroup: SemesterGroup;
	onRatingChanged: () => undefined | Promise<unknown>;
	isOpen?: boolean;
	onToggle: (open: boolean) => void;
}

function SemesterSection({
	seasonGroup,
	onRatingChanged,
	isOpen: controlledIsOpen,
	onToggle,
}: Readonly<SemesterSectionProps>) {
	const currentSemester = useMemo(() => getCurrentSemester(), []);
	const isCurrent =
		seasonGroup.year != null &&
		seasonGroup.seasonRaw != null &&
		isCurrentSemester(
			{ year: seasonGroup.year, season: seasonGroup.seasonRaw },
			currentSemester,
		);
	const isFuture =
		seasonGroup.year != null &&
		seasonGroup.seasonRaw != null &&
		isFutureSemester(
			{ year: seasonGroup.year, season: seasonGroup.seasonRaw },
			currentSemester,
		);

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

				<div className="flex items-center gap-3 shrink-0 px-1">
					<div className="flex items-center gap-2">
						{percentage < 100 && seasonGroup.unratedRateableCount > 0 && (
							<div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
								<CircularProgress
									value={percentage}
									size={14}
									strokeWidth={2.5}
								/>
								<span className="text-[10px] text-muted-foreground font-medium">
									{percentage}%
								</span>
							</div>
						)}
						{seasonGroup.unratedRateableCount > 0 && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge
										variant="secondary"
										className="h-5 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-help"
									>
										Ще {seasonGroup.unratedRateableCount} оцінити
									</Badge>
								</TooltipTrigger>
								<TooltipContent side="top" className="text-[11px] px-2 py-1">
									Твої оцінки допоможуть іншим студентам обрати цей курс
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

export const Route = createFileRoute("/my-ratings")({
	component: withAuth(MyRatings),
});

interface SemesterGroup {
	key: string;
	label: string;
	description: string;
	items: StudentRatingsDetailed[];
	order: number;
	ratedCount: number;
	totalCount: number;
	unratedRateableCount: number;
	year?: number;
	seasonRaw?: string;
}

interface YearGroup {
	key: string;
	label: string;
	seasons: SemesterGroup[];
	year?: number;
	total: number;
	ratedCount: number;
}

const TERM_ORDER: Record<string, number> = {
	FALL: 1,
	SPRING: 2,
	SUMMER: 3,
};

function getAcademicYear(
	year: number,
	season: string | undefined,
): { academicYearStart: number; academicYearLabel: string } {
	const academicYearStart = season?.toUpperCase() === "FALL" ? year : year - 1;
	const academicYearLabel = `${academicYearStart} – ${academicYearStart + 1}`;

	return { academicYearStart, academicYearLabel };
}

function groupRatingsByYearAndSemester(
	allRatings: StudentRatingsDetailed[],
	filter: RatingFilter = "all",
): YearGroup[] {
	type YearAccumulator = {
		key: string;
		label: string;
		year?: number;
		seasons: Map<string, SemesterGroup>;
	};

	const years = new Map<string, YearAccumulator>();

	for (const course of allRatings) {
		const isRated = Boolean(course.rated);
		const matchesFilter =
			filter === "all" ||
			(filter === "rated" && isRated) ||
			(filter === "unrated" && !isRated);

		const yearValue =
			typeof course.semester?.year === "number"
				? course.semester?.year
				: undefined;
		const seasonRaw = course.semester?.season?.toUpperCase();

		let yearKey: string;
		let yearLabel: string;
		let academicYearStart: number | undefined;

		if (yearValue == null) {
			yearKey = "unknown";
			yearLabel = "Без року";
		} else {
			const { academicYearStart: ayStart, academicYearLabel } = getAcademicYear(
				yearValue,
				seasonRaw,
			);
			academicYearStart = ayStart;
			yearKey = String(ayStart);
			yearLabel = academicYearLabel;
		}

		if (!years.has(yearKey)) {
			years.set(yearKey, {
				key: yearKey,
				label: yearLabel,
				year: academicYearStart,
				seasons: new Map(),
			});
		}

		let seasonKey = "no-semester";
		let seasonLabel = "Без семестра";
		let seasonDescription = "Невідомий рік";

		if (yearValue != null) {
			seasonKey = seasonRaw ?? "no-semester";
			seasonLabel = seasonRaw
				? getSemesterTermDisplay(seasonRaw, "Невідомий семестр")
				: "Семестр не вказано";
			seasonDescription = seasonRaw
				? `Семестр ${seasonLabel.toLowerCase()}`
				: "Без семестра";
		}

		const seasonOrder = TERM_ORDER[seasonRaw ?? ""] ?? 99;

		const yearEntry = years.get(yearKey);
		if (yearEntry) {
			if (!yearEntry.seasons.has(seasonKey)) {
				yearEntry.seasons.set(seasonKey, {
					key: `${yearKey}-${seasonKey}`,
					label: seasonLabel,
					description: seasonDescription,
					items: [],
					order: seasonOrder,
					ratedCount: 0,
					totalCount: 0,
					unratedRateableCount: 0,
					year: yearValue,
					seasonRaw: seasonRaw,
				});
			}

			const seasonGroup = yearEntry.seasons.get(seasonKey);
			if (seasonGroup) {
				seasonGroup.totalCount++;
				if (isRated) {
					seasonGroup.ratedCount++;
				} else if (course.can_rate) {
					seasonGroup.unratedRateableCount++;
				}

				if (matchesFilter) {
					seasonGroup.items.push(course);
				}
			}
		}
	}

	return Array.from(years.values())
		.sort((a, b) => {
			if (a.key === "unknown") return 1;
			if (b.key === "unknown") return -1;
			return Number(b.key) - Number(a.key);
		})
		.map((year) => {
			const seasons = Array.from(year.seasons.values())
				.filter((s) => s.items.length > 0)
				.sort((a, b) => b.order - a.order);

			const yearTotal = seasons.reduce((acc, s) => acc + s.totalCount, 0);
			const yearRated = seasons.reduce((acc, s) => acc + s.ratedCount, 0);

			return {
				key: year.key,
				label: year.label,
				year: year.year,
				seasons,
				total: yearTotal,
				ratedCount: yearRated,
			};
		})
		.filter((year) => year.seasons.length > 0);
}
