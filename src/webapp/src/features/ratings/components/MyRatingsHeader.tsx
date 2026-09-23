import { PageHeader } from "@/components/PageHeader";
import { testIds } from "@/lib/test-ids";

interface MyRatingsHeaderProps {
	totalCourses: number;
	ratedCourses: number;
}

export function MyRatingsHeader({
	totalCourses,
	ratedCourses,
}: Readonly<MyRatingsHeaderProps>) {
	const percentage =
		totalCourses === 0 ? 0 : Math.round((ratedCourses / totalCourses) * 100);

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
							<span className="mt-2 block h-1.5 w-48 overflow-hidden rounded-full bg-muted">
								<span
									className="block h-full rounded-full bg-primary"
									style={{ width: `${percentage}%` }}
								/>
							</span>
						</>
					) : undefined
				}
			/>
		</div>
	);
}
