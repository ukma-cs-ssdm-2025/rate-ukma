import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleCheck } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
	getBarColor,
	ScaleBar,
	useScoreReveal,
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

type Axis = "difficulty" | "usefulness";

const AXIS_COPY: Record<
	Axis,
	{
		title: string;
		lower: string;
		higher: string;
		verdictLower: string;
		verdictHigher: string;
	}
> = {
	difficulty: {
		title: "Складність",
		lower: "легше",
		higher: "складніше",
		verdictLower: "легшим",
		verdictHigher: "складнішим",
	},
	usefulness: {
		title: "Корисність",
		lower: "менш корисно",
		higher: "корисніше",
		verdictLower: "менш корисним",
		verdictHigher: "кориснішим",
	},
};

function ratingsWord(count: number): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	return mod10 === 1 && mod100 !== 11 ? "оцінкою" : "оцінками";
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

// Beyond this the gap reads as clear rather than slight.
const CLEAR_THRESHOLD = 1.25;

/** The gap in words: a 0.6 on a 1 to 5 scale means little to a reader as a number. */
function differenceText(
	mine: number,
	others: number,
	copy: { lower: string; higher: string },
): string {
	const word = mine > others ? copy.higher : copy.lower;
	const degree =
		Math.abs(mine - others) >= CLEAR_THRESHOLD ? "Помітно" : "Трохи";
	return `${degree} ${word}`;
}

function direction(mine: number, others: number | null): -1 | 0 | 1 {
	if (others == null) return 0;
	const diff = mine - others;
	if (Math.abs(diff) < SAME_THRESHOLD) return 0;
	return diff > 0 ? 1 : -1;
}

function verdict(scores: Scores, others: Record<Axis, number | null>): string {
	const parts = (["difficulty", "usefulness"] as const)
		.map((axis) => {
			const dir = direction(scores[axis], others[axis]);
			if (dir === 0) return null;
			return dir > 0
				? AXIS_COPY[axis].verdictHigher
				: AXIS_COPY[axis].verdictLower;
		})
		.filter(Boolean);
	if (parts.length === 0) return "Ви оцінили курс так само, як інші";
	return `Вам курс здався ${parts.join(" і ")}, ніж іншим`;
}

function BarRow({
	label,
	value,
	accent,
	display,
}: Readonly<{
	label: string;
	value: number | null;
	accent: string;
	/** The number at the end; the student's own row has its big number instead. */
	display?: string;
}>) {
	return (
		<div className="flex items-center gap-3">
			<span className="w-7 shrink-0 text-xs text-muted-foreground sm:w-9">
				{label}
			</span>
			<div className="min-w-0 flex-1">
				<ScaleBar value={value} accent={accent} />
			</div>
			<span className="w-7 shrink-0 text-right text-xs font-medium tabular-nums">
				{display}
			</span>
		</div>
	);
}

function AxisPanel({
	axis,
	mine,
	others,
}: Readonly<{ axis: Axis; mine: number; others: number | null }>) {
	// The course page's count-up and bar sweep, run on the student's own score.
	const ref = useScoreReveal(mine);
	const copy = AXIS_COPY[axis];
	const tone = axis === "difficulty" ? getDifficultyTone : getUsefulnessTone;
	const dir = direction(mine, others);

	return (
		<Card className="shadow-sm">
			<CardContent ref={ref} className="space-y-4 p-3 sm:p-5">
				<div className="flex flex-col items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-3">
					<p className="text-sm font-medium text-muted-foreground">
						{copy.title}
					</p>
					{others == null ? null : (
						<Badge variant={dir === 0 ? "secondary" : "soft"}>
							{dir === 0 ? "Як у інших" : differenceText(mine, others, copy)}
						</Badge>
					)}
				</div>
				<p className="flex flex-wrap items-baseline gap-x-1.5">
					<span
						data-score
						className={cn(
							"text-4xl font-bold tabular-nums sm:text-5xl",
							tone(mine),
						)}
					>
						{mine.toFixed(1)}
					</span>
					<span className="text-sm text-muted-foreground">ваша оцінка</span>
				</p>
				<div className="space-y-2">
					<BarRow label="Ви" value={mine} accent={getBarColor(axis, mine)} />
					{others == null ? null : (
						<BarRow
							label="Інші"
							value={others}
							accent="bg-muted-foreground/40"
							display={formatDecimalValue(others)}
						/>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

interface RateComparisonProps {
	readonly courseId: string;
	readonly scores: Scores;
	/** Courses still waiting after this one. */
	readonly remaining: number;
	readonly onNext: () => void;
	readonly nextRef?: React.Ref<HTMLButtonElement>;
}

/**
 * Shown once the student saves: their scores against everyone else's, in the
 * course page's own score cards and animation, so the reveal tells them
 * something the course page cannot.
 */
export function RateComparison({
	courseId,
	scores,
	remaining,
	onNext,
	nextRef,
}: Readonly<RateComparisonProps>) {
	const { data: course } = useCoursesRetrieve(courseId);
	const count = course?.ratings_count ?? 0;
	const others = {
		difficulty: othersAverage(course?.avg_difficulty, count, scores.difficulty),
		usefulness: othersAverage(course?.avg_usefulness, count, scores.usefulness),
	};
	const othersCount = Math.max(0, count - 1);
	const hasOthers = others.difficulty != null && others.usefulness != null;

	return (
		<section aria-labelledby="rate-result" className="space-y-6">
			<div className="space-y-2">
				<p className="flex items-center gap-1.5 text-sm font-medium text-primary">
					<CircleCheck className="size-4" aria-hidden="true" />
					Оцінку збережено
				</p>
				<h2
					id="rate-result"
					className="text-lg font-semibold tracking-tight text-balance"
				>
					{hasOthers ? verdict(scores, others) : "Ви оцінили цей курс першими"}
				</h2>
				<p className="text-muted-foreground">
					{hasOthers
						? `Порівняно з ${othersCount} ${ratingsWord(othersCount)} інших студентів`
						: "Ваша оцінка вже допоможе тим, хто обиратиме"}
				</p>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:gap-4">
				<AxisPanel
					axis="difficulty"
					mine={scores.difficulty}
					others={others.difficulty}
				/>
				<AxisPanel
					axis="usefulness"
					mine={scores.usefulness}
					others={others.usefulness}
				/>
			</div>

			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
				<Button variant="ghost" asChild className="w-full sm:w-auto">
					<Link to="/courses/$courseId" params={{ courseId }}>
						Відгуки про курс
					</Link>
				</Button>
				<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
					<Button
						ref={nextRef}
						size="lg"
						onClick={onNext}
						className="w-full sm:w-auto"
					>
						{remaining > 0 ? "Наступний курс" : "Завершити"}
						<ArrowRight aria-hidden="true" />
					</Button>
				</div>
			</div>
		</section>
	);
}
