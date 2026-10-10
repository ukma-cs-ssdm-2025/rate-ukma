import { Card, CardContent } from "@/components/ui/Card";

/** How many enrolled students rated, the first thing a teacher checks. */
export function ParticipationCard({
	rated,
	enrolled,
	commented,
}: Readonly<{
	rated: number;
	enrolled: number;
	/** `null` while scores are hidden, so the count gives nothing away. */
	commented: number | null;
}>) {
	const percent = enrolled > 0 ? Math.round((rated / enrolled) * 100) : 0;
	return (
		<Card className="shadow-sm">
			<CardContent className="space-y-3 p-4 sm:p-5">
				<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<p className="flex items-baseline gap-1.5">
						<span className="text-3xl font-bold tabular-nums">{rated}</span>
						<span className="text-muted-foreground">
							з {enrolled} студентів оцінили
						</span>
					</p>
					<span className="text-sm font-medium tabular-nums text-primary">
						{percent}%
					</span>
				</div>
				<div
					className="h-2 overflow-hidden rounded-full bg-muted"
					role="progressbar"
					aria-label="Частка студентів, які оцінили"
					aria-valuenow={percent}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					<div
						className="h-full rounded-full bg-primary"
						style={{ width: `${percent}%` }}
					/>
				</div>
				{commented == null ? null : (
					<p className="text-sm text-muted-foreground">
						{commented > 0
							? `${commented} залишили коментар`
							: "Коментарів поки немає"}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
