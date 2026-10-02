import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
	getBarColor,
	ScaleBar,
} from "@/features/courses/components/CourseStatsCards";
import {
	formatDecimalValue,
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import { useCoursesRetrieve } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import type { Scores } from "./useRateQueue";

// Closer than this to the others' average reads as "the same".
const SAME_THRESHOLD = 0.5;

function ratingsWord(count: number): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return "оцінкою";
	return "оцінками";
}

/**
 * The others' average without the student's own score: the course detail
 * already counts the rating that was just saved.
 */
function othersAverage(
	average: number | null | undefined,
	count: number,
	mine: number,
): number | null {
	if (average == null || count < 2) return null;
	return (average * count - mine) / (count - 1);
}

function compare(mine: number, others: number): -1 | 0 | 1 {
	const diff = mine - others;
	if (Math.abs(diff) < SAME_THRESHOLD) return 0;
	return diff > 0 ? 1 : -1;
}

function verdict(difficulty: -1 | 0 | 1, usefulness: -1 | 0 | 1): string {
	const parts = [
		{ [-1]: "легшим", 0: null, 1: "складнішим" }[difficulty],
		{ [-1]: "менш корисним", 0: null, 1: "кориснішим" }[usefulness],
	].filter(Boolean);
	if (parts.length === 0) return "Ви оцінили курс так само, як інші";
	return `Вам курс здався ${parts.join(" і ")}, ніж іншим`;
}

/** Where ScaleBar's segment for a whole score ends: five segments, 4px gaps. */
function segmentEnd(score: number): string {
	return `calc(${(score / 5) * 100}% + ${0.8 * score - 4}px)`;
}

/** Marks a score on the course page's scale bar. */
function YouMarker({ className }: Readonly<{ className?: string }>) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"block size-3 rounded-full border-2 border-background bg-foreground shadow-sm",
				className,
			)}
		/>
	);
}

function ComparisonRow({
	label,
	mine,
	others,
	type,
}: Readonly<{
	label: string;
	mine: number;
	others: number | null;
	type: "difficulty" | "usefulness";
}>) {
	const tone = type === "difficulty" ? getDifficultyTone : getUsefulnessTone;
	return (
		<div className="space-y-2.5">
			<div className="flex items-baseline justify-between gap-4">
				<p className="text-sm font-medium">{label}</p>
				<p className="flex items-center gap-4 text-sm text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<YouMarker />
						Ви
						<span className={cn("font-semibold tabular-nums", tone(mine))}>
							{mine}
						</span>
					</span>
					{others != null ? (
						<span>
							Інші{" "}
							<span className="font-semibold text-foreground tabular-nums">
								{formatDecimalValue(others)}
							</span>
						</span>
					) : null}
				</p>
			</div>
			<div className="relative">
				<ScaleBar value={others} accent={getBarColor(type, others)} />
				{/* Segments end at whole scores, so a 4 sits where the fourth ends. */}
				<span
					aria-hidden="true"
					className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
					style={{ left: segmentEnd(mine) }}
				>
					<YouMarker />
				</span>
			</div>
		</div>
	);
}

interface RateComparisonProps {
	readonly courseId: string;
	readonly scores: Scores;
	readonly hasNext: boolean;
	readonly onNext: () => void;
	readonly nextRef?: React.Ref<HTMLButtonElement>;
}

/**
 * Shown once the student saves: their scores against everyone else's on the
 * course page's own scale, so the reveal says something the course page cannot.
 */
export function RateComparison({
	courseId,
	scores,
	hasNext,
	onNext,
	nextRef,
}: Readonly<RateComparisonProps>) {
	const { data: course } = useCoursesRetrieve(courseId);
	const count = course?.ratings_count ?? 0;
	const othersCount = Math.max(0, count - 1);
	const othersDifficulty = othersAverage(
		course?.avg_difficulty,
		count,
		scores.difficulty,
	);
	const othersUsefulness = othersAverage(
		course?.avg_usefulness,
		count,
		scores.usefulness,
	);
	const hasOthers = othersDifficulty != null && othersUsefulness != null;

	return (
		<Card className="shadow-sm">
			<div className="space-y-6 p-6">
				<div className="space-y-1.5">
					<h2 className="text-lg font-semibold leading-snug">
						{hasOthers
							? verdict(
									compare(scores.difficulty, othersDifficulty),
									compare(scores.usefulness, othersUsefulness),
								)
							: "Ви оцінили цей курс першими"}
					</h2>
					<p className="text-sm text-muted-foreground">
						{hasOthers
							? `Порівняно з ${othersCount} ${ratingsWord(othersCount)} інших студентів`
							: "Ваша оцінка вже допомагає тим, хто обиратиме"}
					</p>
				</div>
				<ComparisonRow
					label="Складність"
					mine={scores.difficulty}
					others={othersDifficulty}
					type="difficulty"
				/>
				<ComparisonRow
					label="Корисність"
					mine={scores.usefulness}
					others={othersUsefulness}
					type="usefulness"
				/>
			</div>
			<div className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
				<Button variant="ghost" asChild className="w-full sm:w-auto">
					<Link to="/courses/$courseId" params={{ courseId }}>
						Відгуки про курс
					</Link>
				</Button>
				<Button
					ref={nextRef}
					size="lg"
					onClick={onNext}
					className="w-full sm:w-auto"
				>
					{hasNext ? "Наступний курс" : "Завершити"}
					<ArrowRight aria-hidden="true" />
				</Button>
			</div>
		</Card>
	);
}
