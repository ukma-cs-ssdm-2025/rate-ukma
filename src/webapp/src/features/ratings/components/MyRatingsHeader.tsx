import { PageHeader } from "@/components/PageHeader";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";

const MAX_SEGMENTS = 40;
const SEGMENT_KEYS = Array.from(
	{ length: MAX_SEGMENTS },
	(_, i) => `progress-segment-${i}`,
);

interface MyRatingsHeaderProps {
	totalCourses: number;
	ratedCourses: number;
}

export function MyRatingsHeader({
	totalCourses,
	ratedCourses,
}: Readonly<MyRatingsHeaderProps>) {
	// One segment per course reads as courses left; past the cap a segment spans several.
	const segments = Math.min(totalCourses, MAX_SEGMENTS);
	const filled = Math.round(
		(ratedCourses / Math.max(totalCourses, 1)) * segments,
	);

	return (
		<div data-testid={testIds.myRatings.header}>
			<PageHeader
				title="Мої оцінки"
				description={
					totalCourses > 0 ? (
						<>
							<span className="tabular-nums">
								Оцінено {ratedCourses} з {totalCourses}
							</span>
							<span
								className="mt-3 flex h-1.5 w-md max-w-full gap-1"
								aria-hidden="true"
							>
								{SEGMENT_KEYS.slice(0, segments).map((key, index) => (
									<span
										key={key}
										className={cn(
											"h-full flex-1 rounded-full",
											index < filled ? "bg-primary" : "bg-muted",
										)}
									/>
								))}
							</span>
						</>
					) : undefined
				}
			/>
		</div>
	);
}
