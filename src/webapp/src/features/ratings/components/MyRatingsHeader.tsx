import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import type { RatingFilter } from "@/features/ratings/groupRatings";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";

interface MyRatingsHeaderProps {
	totalCourses: number;
	ratedCourses: number;
	isLoading: boolean;
	filter: RatingFilter;
	onFilterChange: (filter: RatingFilter) => void;
}

export function MyRatingsHeader({
	totalCourses,
	ratedCourses,
	isLoading,
	filter,
	onFilterChange,
}: Readonly<MyRatingsHeaderProps>) {
	const unratedCount = totalCourses - ratedCourses;
	const percentage =
		totalCourses === 0 ? 0 : Math.round((ratedCourses / totalCourses) * 100);

	const filters: { value: RatingFilter; label: string }[] = [
		{ value: "all", label: "Усі" },
		{ value: "unrated", label: "Не оцінено" },
		{ value: "rated", label: "Оцінено" },
	];

	return (
		<div data-testid={testIds.myRatings.header}>
			<PageHeader
				title="Мої оцінки"
				description={
					!isLoading && totalCourses > 0 ? (
						<>
							Оцінено {ratedCourses} з {totalCourses}
							<span className="mt-2 block h-1.5 w-48 overflow-hidden rounded-full bg-muted">
								<span
									className="block h-full rounded-full bg-primary"
									style={{ width: `${percentage}%` }}
								/>
							</span>
						</>
					) : undefined
				}
				actions={
					!isLoading && totalCourses > 0 ? (
						<div className="flex items-center rounded-lg border bg-muted/30 p-1">
							{filters.map(({ value, label }) => {
								const countByFilter: Record<RatingFilter, number> = {
									all: totalCourses,
									rated: ratedCourses,
									unrated: unratedCount,
								};
								const count = countByFilter[value];
								return (
									<Button
										key={value}
										variant="ghost"
										size="sm"
										onClick={() => onFilterChange(value)}
										className={cn(
											"h-8 px-3 text-sm font-medium rounded-md transition-all",
											filter === value
												? "bg-background shadow-sm text-foreground"
												: "text-muted-foreground hover:text-foreground hover:bg-transparent",
										)}
									>
										{label}
										<span
											className={cn(
												"ml-1.5 text-xs",
												filter === value
													? "text-muted-foreground"
													: "text-muted-foreground/60",
											)}
										>
											{count}
										</span>
									</Button>
								);
							})}
						</div>
					) : undefined
				}
			/>
		</div>
	);
}
