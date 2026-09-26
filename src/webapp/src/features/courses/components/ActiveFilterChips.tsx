import { memo } from "react";

import { X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import type { FilterOptions } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { getActiveFilterChips } from "../hooks/useCourseFiltersData";
import type { CourseFiltersParamsState } from "../courseFiltersParams";

export const ActiveFilterChips = memo(function ActiveFilterChips({
	params,
	setParams,
	filterOptions,
	className,
}: Readonly<{
	params: CourseFiltersParamsState;
	setParams: (updates: Partial<CourseFiltersParamsState>) => void;
	filterOptions?: FilterOptions;
	className?: string;
}>) {
	const chips = getActiveFilterChips(params, filterOptions);
	if (chips.length === 0) return null;

	return (
		<div className={cn("flex flex-wrap items-center gap-1.5", className)}>
			{chips.map((chip) => (
				<Badge
					key={chip.key}
					variant="secondary"
					className="gap-1 py-1 pl-2.5 pr-1.5"
				>
					<span>{chip.label}</span>
					<button
						type="button"
						aria-label={`Прибрати фільтр ${chip.label}`}
						onClick={() => setParams({ ...chip.clear, page: 1 })}
						className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-muted hover:text-foreground"
					>
						<X className="size-3" aria-hidden="true" />
					</button>
				</Badge>
			))}
		</div>
	);
});
