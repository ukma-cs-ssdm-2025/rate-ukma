import { ListCollapse, ListFilter } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { CircularProgress } from "@/components/ui/CircularProgress";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";

export type RatingFilter = "all" | "unrated" | "rated";

interface MyRatingsHeaderProps {
	totalCourses: number;
	ratedCourses: number;
	isLoading: boolean;
	filter: RatingFilter;
	onFilterChange: (filter: RatingFilter) => void;
	isAllExpanded: boolean;
	onToggleExpandAll: () => void;
}

function getPercentage(value: number, total: number): number {
	if (total === 0) return 0;
	return Math.round((value / total) * 100);
}

export function MyRatingsHeader({
	totalCourses,
	ratedCourses,
	isLoading,
	filter,
	onFilterChange,
	isAllExpanded,
	onToggleExpandAll,
}: Readonly<MyRatingsHeaderProps>) {
	const percentage = getPercentage(ratedCourses, totalCourses);
	const unratedCount = totalCourses - ratedCourses;

	const filters: { value: RatingFilter; label: string }[] = [
		{ value: "all", label: "Усі" },
		{ value: "unrated", label: "Не оцінено" },
		{ value: "rated", label: "Оцінено" },
	];

	return (
		<div data-testid={testIds.myRatings.header} className="space-y-6">
			<div className="flex items-center justify-between flex-wrap gap-4">
				<div className="flex items-center gap-3">
					<h1 className="text-2xl font-bold tracking-tight">Мої оцінки</h1>
					{!isLoading && totalCourses > 0 && (
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex items-center gap-2 cursor-default">
									<CircularProgress
										value={percentage}
										size={28}
										strokeWidth={3}
									/>
									<span className="text-sm text-muted-foreground">
										{percentage}%
									</span>
								</div>
							</TooltipTrigger>
							<TooltipContent>
								{ratedCourses} з {totalCourses} оцінено
							</TooltipContent>
						</Tooltip>
					)}
				</div>

				{!isLoading && totalCourses > 0 && (
					<div className="flex items-center gap-4">
						<div className="hidden sm:flex items-center rounded-lg border bg-muted/30 p-1">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-8 px-2 rounded-md hover:bg-transparent text-muted-foreground hover:text-foreground"
										onClick={onToggleExpandAll}
										aria-label={
											isAllExpanded ? "Згорнути все" : "Розгорнути все"
										}
										aria-pressed={isAllExpanded}
									>
										{isAllExpanded ? (
											<ListCollapse className="size-4" />
										) : (
											<ListFilter className="size-4" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{isAllExpanded ? "Згорнути все" : "Розгорнути все"}
								</TooltipContent>
							</Tooltip>
						</div>

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
					</div>
				)}
			</div>
		</div>
	);
}
