import { useLayoutEffect, useRef } from "react";

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
								data-fill
								className={cn(
									"absolute inset-y-0 left-0 origin-left rounded-full",
									accent,
								)}
								style={{ width: `${fillPercent}%` }}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}

const REVEAL_MS = 700;

// On arrival the score counts up from zero while the bar fills left to right.
// It runs before paint, so the final value never flashes first.
function useScoreReveal(value: number | null) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const root = ref.current;
		const text = root?.querySelector("[data-score]")?.firstChild;
		if (!root || !text || value == null) return;
		if (
			!globalThis.matchMedia?.("(prefers-reduced-motion: no-preference)")
				.matches
		) {
			return;
		}
		for (const [index, fill] of root
			.querySelectorAll<HTMLElement>("[data-fill]")
			.entries()) {
			fill.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
				duration: 240,
				delay: index * 100,
				easing: "cubic-bezier(0.2, 0, 0, 1)",
				fill: "backwards",
			});
		}
		const start = performance.now();
		let frame = 0;
		const tick = (now: number) => {
			const progress = Math.min(1, (now - start) / REVEAL_MS);
			text.nodeValue = (value * (1 - (1 - progress) ** 3)).toFixed(1);
			if (progress < 1) frame = requestAnimationFrame(tick);
		};
		text.nodeValue = (0).toFixed(1);
		frame = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(frame);
			text.nodeValue = value.toFixed(1);
		};
	}, [value]);
	return ref;
}

function ScorePanel({
	title,
	value,
	type,
	formatted,
	accent,
	barColor,
}: Readonly<{
	title: string;
	value: number | null;
	type: "difficulty" | "usefulness";
	formatted: string;
	accent: string;
	barColor: string;
}>) {
	const ref = useScoreReveal(value);
	return (
		<Card
			className="shadow-sm"
			title={value === null ? undefined : getDetailedDescription(value, type)}
		>
			<CardContent ref={ref} className="p-4 sm:p-5">
				<p className="text-sm font-medium text-muted-foreground">{title}</p>
				<p className="mt-1 flex items-baseline gap-1.5">
					<span
						data-score
						className={cn(
							"text-4xl font-bold tabular-nums sm:text-5xl",
							value == null ? "text-muted-foreground" : accent,
						)}
					>
						{formatted}
					</span>
					<span className="text-sm text-muted-foreground">з 5</span>
				</p>
				<div className="mt-3">
					<ScaleBar value={value} accent={barColor} />
				</div>
				<p className="mt-2 text-sm text-muted-foreground">
					{getDescription(value, type)}
				</p>
			</CardContent>
		</Card>
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
		<div
			data-testid={testIds.courseDetails.statsCards}
			className="grid grid-cols-2 gap-3 sm:gap-4"
		>
			{panels.map((panel) => (
				<ScorePanel key={panel.title} {...panel} />
			))}
		</div>
	);
}

export function CourseStatsHeroSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-3 sm:gap-4" aria-hidden="true">
			{[0, 1].map((i) => (
				<Card key={`stats-skeleton-${i}`} className="shadow-sm">
					<CardContent className="p-4 sm:p-5">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="mt-1 h-10 w-20 sm:h-12" />
						<div className="mt-3 flex gap-1">
							{SCALE_KEYS.map((key) => (
								<Skeleton key={key} className="h-1.5 flex-1 rounded-full" />
							))}
						</div>
						<Skeleton className="mt-2 h-4 w-32" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}
