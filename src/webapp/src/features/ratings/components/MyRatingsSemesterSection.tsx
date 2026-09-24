import { useMemo, useState } from "react";

import { ChevronRight, CircleCheck } from "lucide-react";

import { TermBadge } from "@/components/TermBadge";
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

// Mirrors SemesterService on the backend: the term a month falls in, and the
// month from which that term's courses can be rated.
const TERM_START_MONTH: Record<string, number> = {
	SPRING: 0,
	SUMMER: 4,
	FALL: 8,
};
const TERM_MIDTERM_MONTH: Record<string, number> = {
	SPRING: 2,
	SUMMER: 5,
	FALL: 10,
};

type SemesterTiming = "past" | "current" | "future";

function semesterTiming(
	year: number | undefined,
	season: string | undefined,
	now: Date,
): SemesterTiming {
	const startMonth = TERM_START_MONTH[season?.toUpperCase() ?? ""];
	if (year == null || startMonth == null) return "past";
	if (now < new Date(year, startMonth, 1)) return "future";
	return now < new Date(year, startMonth + 4, 1) ? "current" : "past";
}

function currentPeriod(now: Date): string {
	const month = now.getMonth();
	let term = "SPRING";
	if (month >= TERM_START_MONTH.FALL) term = "FALL";
	else if (month >= TERM_START_MONTH.SUMMER) term = "SUMMER";
	return `${now.getFullYear()}-${term}`;
}

interface StoredOpenState {
	period: string;
	open: Record<string, boolean>;
}

// Choices hold for the current term only: a new term starts from the defaults,
// so it opens on what is newly rateable instead of last term's layout.
function readOpenState(period: string): Record<string, boolean> {
	const stored = localStorageAdapter.getItem<StoredOpenState>(OPEN_STATE_KEY);
	return stored?.period === period ? stored.open : {};
}

function useSemesterOpen(key: string, defaultOpen: boolean) {
	const period = currentPeriod(new Date());
	const [open, setOpen] = useState(
		() => readOpenState(period)[key] ?? defaultOpen,
	);
	const change = (next: boolean) => {
		setOpen(next);
		localStorageAdapter.setItem<StoredOpenState>(OPEN_STATE_KEY, {
			period,
			open: { ...readOpenState(period), [key]: next },
		});
	};
	return [open, change] as const;
}

const UK_PLURAL = new Intl.PluralRules("uk");
const COURSE_FORMS: Record<Intl.LDMLPluralRule, string> = {
	zero: "курсів",
	one: "курс",
	two: "курси",
	few: "курси",
	many: "курсів",
	other: "курсу",
};
const DAY_MONTH = new Intl.DateTimeFormat("uk-UA", {
	day: "numeric",
	month: "long",
});

// One status per semester. The call to rate shows only while the semester is
// closed: once open, each row's «Оцінити» button is the call.
function SemesterStatus({
	seasonGroup,
	timing,
	open,
}: Readonly<{
	seasonGroup: SemesterGroup;
	timing: SemesterTiming;
	open: boolean;
}>) {
	if (timing === "future") {
		return <span className="text-muted-foreground">Ще не розпочався</span>;
	}
	const left = seasonGroup.unratedRateableCount;
	if (left > 0) {
		if (open) return null;
		return (
			<span className="font-medium text-primary">
				Оцініть ще {left} {COURSE_FORMS[UK_PLURAL.select(left)]}
			</span>
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
	const midterm =
		TERM_MIDTERM_MONTH[seasonGroup.seasonRaw?.toUpperCase() ?? ""];
	if (seasonGroup.year == null || midterm == null) {
		return <span className="text-muted-foreground">Оцінювання згодом</span>;
	}
	return (
		<span className="text-muted-foreground">
			Оцінювання з {DAY_MONTH.format(new Date(seasonGroup.year, midterm, 1))}
		</span>
	);
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
	// Open by default: the running semester and anything still waiting for a rating.
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
					<span className="ml-auto text-xs sm:text-sm">
						<SemesterStatus
							seasonGroup={seasonGroup}
							timing={timing}
							open={open}
						/>
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
