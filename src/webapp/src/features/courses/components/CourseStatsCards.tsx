import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import {
	difficultyDescriptions,
	usefulnessDescriptions,
} from "../../ratings/definitions/ratingDefinitions";
import {
	DIFFICULTY_RANGE,
	formatRatingsBasis,
	USEFULNESS_RANGE,
	getDifficultyTone,
	getUsefulnessTone,
} from "../courseFormatting";

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
		if (value >= 4) return "bg-destructive";
		if (value >= 3) return "bg-chart-5";
		return "bg-primary";
	}
	if (value >= 4) return "bg-primary";
	if (value >= 3) return "bg-chart-2";
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
	// Only scores in the valid range are meaningful; treat the rest as missing
	const diff =
		difficulty != null &&
		difficulty >= DIFFICULTY_RANGE[0] &&
		difficulty <= DIFFICULTY_RANGE[1]
			? difficulty
			: null;
	const useful =
		usefulness != null &&
		usefulness >= USEFULNESS_RANGE[0] &&
		usefulness <= USEFULNESS_RANGE[1]
			? usefulness
			: null;
	const hasRatings = ratingsCount != null && ratingsCount > 0;
	const hasScores = diff != null || useful != null;

	if (!hasRatings && !hasScores) {
		return null;
	}

	const basis = formatRatingsBasis(ratingsCount);
	const panels = [
		{
			title: "Складність",
			value: diff,
			type: "difficulty" as const,
			formatted: diff?.toFixed(1) ?? "—",
			accent: getDifficultyTone(diff),
			barColor: getBarColor("difficulty", diff),
		},
		{
			title: "Корисність",
			value: useful,
			type: "usefulness" as const,
			formatted: useful?.toFixed(1) ?? "—",
			accent: getUsefulnessTone(useful),
			barColor: getBarColor("usefulness", useful),
		},
	];

	return (
		<div data-testid={testIds.courseDetails.statsCards}>
			<Card className="shadow-sm">
				<CardContent className="space-y-5 p-4 sm:p-5">
					{panels.map((panel) => (
						<div
							key={panel.title}
							title={
								panel.value !== null
									? getDetailedDescription(panel.value, panel.type)
									: undefined
							}
						>
							<p className="text-sm font-medium text-muted-foreground">
								{panel.title}
							</p>
							<p
								className={cn(
									"mt-1 text-3xl font-bold tabular-nums sm:text-4xl",
									panel.value != null ? panel.accent : "text-muted-foreground",
								)}
							>
								{panel.formatted}
							</p>
							<div className="mt-2.5">
								<ScaleBar value={panel.value} accent={panel.barColor} />
							</div>
							<p className="mt-2 text-xs text-muted-foreground">
								{getDescription(panel.value, panel.type)}
							</p>
						</div>
					))}
					{basis && <p className="text-xs text-muted-foreground">{basis}</p>}
				</CardContent>
			</Card>
		</div>
	);
}

export function CourseStatsHeroSkeleton() {
	return (
		<div>
			<Card className="shadow-sm" aria-hidden="true">
				<CardContent className="space-y-5 p-4 sm:p-5">
					{[0, 1].map((i) => (
						<div key={`stats-skeleton-${i}`}>
							<Skeleton className="h-4 w-24" />
							<Skeleton className="mt-1 h-10 w-16 sm:h-12" />
							<div className="mt-2.5 flex gap-1">
								{SCALE_KEYS.map((key) => (
									<Skeleton key={key} className="h-1.5 flex-1 rounded-full" />
								))}
							</div>
							<Skeleton className="mt-2 h-3 w-32" />
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}
