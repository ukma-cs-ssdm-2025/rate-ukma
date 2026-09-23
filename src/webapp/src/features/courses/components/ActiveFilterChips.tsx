import { memo } from "react";

import { X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { FilterOptions } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { getActiveFilterChips } from "../hooks/useCourseFiltersData";
import type { CourseFiltersParamsState } from "../courseFiltersParams";

export const ActiveFilterChips = memo(function ActiveFilterChips({
	params,
	setParams,
	filterOptions,
	onReset,
	className,
}: Readonly<{
	params: CourseFiltersParamsState;
	setParams: (updates: Partial<CourseFiltersParamsState>) => void;
	filterOptions?: FilterOptions;
	onReset: () => void;
	className?: string;
}>) {
	const chips = getActiveFilterChips(params, filterOptions);

	if (chips.length === 0) {
		return null;
	}

	return (
		<div className={cn("flex flex-wrap items-center gap-2", className)}>
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
						className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<X className="h-3 w-3" aria-hidden="true" />
					</button>
				</Badge>
			))}
			<Button type="button" variant="ghost" size="sm" onClick={onReset}>
				Скинути все
			</Button>
		</div>
	);
});
