import { useMemo, useState } from "react";

import { ChevronRight, CircleCheck } from "lucide-react";

import { TermBadge } from "@/components/TermBadge";
import { Badge } from "@/components/ui/Badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import type { SemesterGroup } from "@/features/ratings/groupRatings";
import { localStorageAdapter } from "@/lib/storage";
import { testIds } from "@/lib/test-ids";
import { MyRatingCard } from "./MyRatingCard";

const OPEN_STATE_KEY = "my-ratings-open-semesters";

// Calendar month each term starts in (0-based), matching the academic calendar.
const TERM_START_MONTH: Record<string, number> = {
	SPRING: 0,
	SUMMER: 4,
	FALL: 8,
};

type SemesterTiming = "past" | "current" | "future";

function semesterTiming(
	year: number | undefined,
	season: string | undefined,
	now: Date,
): SemesterTiming {
	const startMonth = TERM_START_MONTH[season?.toUpperCase() ?? ""];
	if (year == null || startMonth == null) return "past";
	const start = new Date(year, startMonth, 1);
	const nextStart = new Date(year, startMonth + 4, 1);
	if (now < start) return "future";
	return now < nextStart ? "current" : "past";
}

function readOpenState(): Record<string, boolean> {
	return (
		localStorageAdapter.getItem<Record<string, boolean>>(OPEN_STATE_KEY) ?? {}
	);
}

// Only choices the student made are stored; untouched semesters follow the default.
function useSemesterOpen(key: string, defaultOpen: boolean) {
	const [open, setOpen] = useState(() => readOpenState()[key] ?? defaultOpen);
	const change = (next: boolean) => {
		setOpen(next);
		localStorageAdapter.setItem(OPEN_STATE_KEY, {
			...readOpenState(),
			[key]: next,
		});
	};
	return [open, change] as const;
}

function SemesterStatus({
	seasonGroup,
	timing,
}: Readonly<{ seasonGroup: SemesterGroup; timing: SemesterTiming }>) {
	if (timing === "future") {
		return <span className="text-muted-foreground">Ще не розпочався</span>;
	}
	if (seasonGroup.unratedRateableCount > 0) {
		return (
			<Badge variant="soft" className="tabular-nums">
				{seasonGroup.unratedRateableCount} до оцінки
			</Badge>
		);
	}
	if (seasonGroup.ratedCount === seasonGroup.totalCount) {
		return (
			<span className="inline-flex items-center gap-1 text-success">
				<CircleCheck className="size-4" aria-hidden="true" />
				Усе оцінено
			</span>
		);
	}
	return <span className="text-muted-foreground">Оцінювання згодом</span>;
}

interface MyRatingsSemesterSectionProps {
	seasonGroup: SemesterGroup;
	onRatingChanged: () => undefined | Promise<unknown>;
}

export function MyRatingsSemesterSection({
	seasonGroup,
	onRatingChanged,
}: Readonly<MyRatingsSemesterSectionProps>) {
	const timing = semesterTiming(
		seasonGroup.year,
		seasonGroup.seasonRaw,
		new Date(),
	);
	// What still needs a rating, or is under way, starts open; the rest stays out of the way.
	const [open, setOpen] = useSemesterOpen(
		`${seasonGroup.year ?? "none"}-${seasonGroup.key}`,
		timing !== "future" &&
			(seasonGroup.unratedRateableCount > 0 || timing === "current"),
	);

	const sortedItems = useMemo(() => {
		// What is left to rate scans first; rated rows stay alphabetical after it.
		return [...seasonGroup.items].sort((a, b) => {
			const pendingA = a.rated ? 1 : 0;
			const pendingB = b.rated ? 1 : 0;
			if (pendingA !== pendingB) return pendingA - pendingB;
			return (a.course_title ?? "").localeCompare(b.course_title ?? "");
		});
	}, [seasonGroup.items]);

	if (sortedItems.length === 0) return null;

	return (
		<Collapsible open={open} onOpenChange={setOpen} asChild>
			<section aria-label={seasonGroup.description}>
				<CollapsibleTrigger
					className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
					data-testid={testIds.myRatings.semesterTrigger}
				>
					<ChevronRight
						className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90 motion-reduce:transition-none"
						aria-hidden="true"
					/>
					{seasonGroup.seasonRaw ? (
						<TermBadge term={seasonGroup.seasonRaw}>
							{seasonGroup.label}
						</TermBadge>
					) : (
						<span className="font-medium text-foreground">
							{seasonGroup.label}
						</span>
					)}
					<span className="text-muted-foreground tabular-nums">
						{seasonGroup.ratedCount} з {seasonGroup.totalCount}
					</span>
					<span className="ml-auto text-xs">
						<SemesterStatus seasonGroup={seasonGroup} timing={timing} />
					</span>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="space-y-1 pb-2 pl-6">
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
			</section>
		</Collapsible>
	);
}
