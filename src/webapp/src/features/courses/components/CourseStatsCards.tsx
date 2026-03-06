import { Skeleton } from "@/components/ui/Skeleton";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import {
	difficultyDescriptions,
	usefulnessDescriptions,
} from "../../ratings/definitions/ratingDefinitions";
import { getDifficultyTone, getUsefulnessTone } from "../courseFormatting";

const SCALE_STEPS = 5;
const SCALE_KEYS = Array.from({ length: SCALE_STEPS }, (_, i) => `s-${i}`);

interface CourseStatsHeroProps {
	difficulty: number | null;
	usefulness: number | null;
	ratingsCount: number | null;
}

function getDescription(
	value: number | null,
	type: "difficulty" | "usefulness",
): string {
	if (value == null) return "Недостатньо оцінок";

	if (type === "difficulty") {
		if (value < 2.5) return "Легше багатьох курсів";
		if (value < 3.5) return "Стандартне навантаження";
		return "Потребує більше часу";
	}

	if (value < 2.5) return "Можна покращити";
	if (value < 3.5) return "Знання застосовні";
	return "Дуже корисний курс";
}

function getDetailedDescription(
	value: number | null,
	type: "difficulty" | "usefulness",
): string {
	if (value == null) return "Недостатньо даних";
	const roundedValue = Math.round(value);
	const descriptions =
		type === "difficulty" ? difficultyDescriptions : usefulnessDescriptions;
	return descriptions[roundedValue as keyof typeof descriptions] || "";
}

function getBarColor(
	type: "difficulty" | "usefulness",
	value: number | null,
): string {
	if (value == null) return "bg-muted-foreground/20";

	if (type === "difficulty") {
		if (value >= 4) return "bg-[var(--destructive)]";
		if (value >= 3) return "bg-[var(--chart-5)]";
		return "bg-[var(--primary)]";
	}
	if (value >= 4) return "bg-[var(--primary)]";
	if (value >= 3) return "bg-[var(--chart-2)]";
	return "bg-muted-foreground";
}

/**
 * Fractional scale bar: for 3.4/5, segments 1-3 are fully filled,
 * segment 4 is 40% filled, segment 5 is empty.
 */
function ScaleBar({
	value,
	accent,
}: Readonly<{ value: number | null; accent: string }>) {
	return (
		<div className="flex gap-1" aria-hidden="true">
			{SCALE_KEYS.map((key, i) => {
				const segmentIndex = i + 1;
				let fillPercent = 0;
				if (value != null) {
					if (value >= segmentIndex) {
						fillPercent = 100;
					} else if (value > segmentIndex - 1) {
						fillPercent = (value - (segmentIndex - 1)) * 100;
					}
				}

				return (
					<div
						key={key}
						className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
					>
						{fillPercent > 0 && (
							<div
								className={cn("absolute inset-y-0 left-0 rounded-full", accent)}
								style={{ width: `${fillPercent}%` }}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}

export function CourseStatsHero({
	difficulty,
	usefulness,
	ratingsCount,
}: Readonly<CourseStatsHeroProps>) {
	const hasRatings = ratingsCount != null && ratingsCount > 0;
	const hasScores = difficulty != null || usefulness != null;

	if (!hasRatings && !hasScores) {
		return null;
	}

	const panels = [
		{
			title: "Складність",
			value: difficulty,
			type: "difficulty" as const,
			formatted: difficulty?.toFixed(1) ?? "—",
			accent: getDifficultyTone(difficulty),
			barColor: getBarColor("difficulty", difficulty),
		},
		{
			title: "Корисність",
			value: usefulness,
			type: "usefulness" as const,
			formatted: usefulness?.toFixed(1) ?? "—",
			accent: getUsefulnessTone(usefulness),
			barColor: getBarColor("usefulness", usefulness),
		},
	];

	return (
		<div data-testid={testIds.courseDetails.statsCards}>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
				{panels.map((panel) => (
					<div
						key={panel.title}
						className="rounded-xl border border-border/60 bg-card/60 p-4 sm:p-5"
						title={
							panel.value !== null
								? getDetailedDescription(panel.value, panel.type)
								: undefined
						}
					>
						<span
							className={cn(
								"text-3xl font-bold tabular-nums sm:text-4xl lg:text-5xl",
								panel.value != null ? panel.accent : "text-muted-foreground",
							)}
						>
							{panel.formatted}
						</span>
						<p className="mt-2 text-sm font-medium text-foreground">
							{panel.title}
						</p>
						<div className="mt-2.5">
							<ScaleBar value={panel.value} accent={panel.barColor} />
						</div>
						<p className="mt-2 text-xs text-muted-foreground">
							{getDescription(panel.value, panel.type)}
						</p>
					</div>
				))}
			</div>
		</div>
	);
}

export function CourseStatsHeroSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
			{[0, 1].map((i) => (
				<div
					key={`stats-skeleton-${i}`}
					className="rounded-xl border border-border/60 bg-card/60 p-4 sm:p-5"
				>
					<Skeleton className="h-10 w-16 sm:h-12" />
					<Skeleton className="mt-2 h-4 w-24" />
					<div className="mt-2.5 flex gap-1">
						{SCALE_KEYS.map((key) => (
							<Skeleton key={key} className="h-1.5 flex-1 rounded-full" />
						))}
					</div>
					<Skeleton className="mt-2 h-3 w-32" />
				</div>
			))}
		</div>
	);
}
