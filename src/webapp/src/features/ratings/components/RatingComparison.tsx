import { formatDecimalValue } from "@/features/courses/courseFormatting";
import { cn } from "@/lib/utils";

interface RatingComparisonProps {
	readonly difficulty: number;
	readonly usefulness: number;
	readonly avgDifficulty?: number | null;
	readonly avgUsefulness?: number | null;
	readonly className?: string;
}

// Half a point either way still reads as "the same" on a 1 to 5 scale.
const SAME_BAND = 0.5;

const VERDICTS = {
	difficulty: ["Легше, ніж у інших", "Як у інших", "Складніше, ніж у інших"],
	usefulness: [
		"Менш корисно, ніж у інших",
		"Як у інших",
		"Корисніше, ніж у інших",
	],
} as const;

function verdict(kind: keyof typeof VERDICTS, mine: number, avg: number) {
	const [lower, same, higher] = VERDICTS[kind];
	if (mine - avg > SAME_BAND) return higher;
	if (avg - mine > SAME_BAND) return lower;
	return same;
}

function ScoreCompare({
	label,
	kind,
	mine,
	avg,
}: Readonly<{
	label: string;
	kind: keyof typeof VERDICTS;
	mine: number;
	avg: number;
}>) {
	return (
		<div className="min-w-0 space-y-2 rounded-xl bg-muted/50 p-4">
			<p className="text-sm text-muted-foreground">{label}</p>
			<div>
				<p className="text-3xl font-semibold tabular-nums">{mine}</p>
				<p className="text-sm text-muted-foreground tabular-nums">
					в інших {formatDecimalValue(avg)}
				</p>
			</div>
			<p className="text-sm font-medium">{verdict(kind, mine, avg)}</p>
		</div>
	);
}

/** The student's own scores next to everyone else's, shown once theirs is saved. */
export function RatingComparison({
	difficulty,
	usefulness,
	avgDifficulty,
	avgUsefulness,
	className,
}: RatingComparisonProps) {
	if (avgDifficulty == null || avgUsefulness == null) return null;

	return (
		<section
			aria-label="Ваша оцінка поруч з іншими"
			className={cn("grid grid-cols-2 gap-3", className)}
		>
			<ScoreCompare
				label="Складність"
				kind="difficulty"
				mine={difficulty}
				avg={avgDifficulty}
			/>
			<ScoreCompare
				label="Корисність"
				kind="usefulness"
				mine={usefulness}
				avg={avgUsefulness}
			/>
		</section>
	);
}
