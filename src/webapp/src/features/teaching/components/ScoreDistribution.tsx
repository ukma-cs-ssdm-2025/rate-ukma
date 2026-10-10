import { Card, CardContent } from "@/components/ui/Card";
import type { ScoreCounts } from "../types";

function DistributionColumn({
	title,
	counts,
}: Readonly<{ title: string; counts: ScoreCounts }>) {
	const max = Math.max(...counts, 1);
	// Highest score on top, as in the rating form.
	const rows = counts
		.map((count, index) => ({ score: index + 1, count }))
		.reverse();
	return (
		<div className="min-w-0 space-y-2">
			<p className="text-sm font-medium text-muted-foreground">{title}</p>
			<ul className="space-y-1.5">
				{rows.map(({ score, count }) => (
					<li
						key={score}
						className="grid grid-cols-[1rem_minmax(0,1fr)_1.5rem] items-center gap-2 text-sm"
					>
						<span className="tabular-nums text-muted-foreground">{score}</span>
						<span className="h-2 overflow-hidden rounded-full bg-muted">
							<span
								className="block h-full rounded-full bg-primary"
								style={{ width: `${(count / max) * 100}%` }}
							/>
						</span>
						<span className="text-right tabular-nums">{count}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

export function ScoreDistribution({
	difficulty,
	usefulness,
}: Readonly<{ difficulty: ScoreCounts; usefulness: ScoreCounts }>) {
	return (
		<Card className="shadow-sm">
			<CardContent className="space-y-4 p-4 sm:p-5">
				<h3 className="font-semibold">Розподіл оцінок</h3>
				<div className="grid gap-6 sm:grid-cols-2">
					<DistributionColumn title="Складність" counts={difficulty} />
					<DistributionColumn title="Корисність" counts={usefulness} />
				</div>
			</CardContent>
		</Card>
	);
}
