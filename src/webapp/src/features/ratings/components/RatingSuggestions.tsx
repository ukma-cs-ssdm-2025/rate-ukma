import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { getSemesterDisplay } from "@/features/courses/courseFormatting";
import type { RatingSuggestion } from "../hooks/useRatingSuggestions";
import { cn } from "@/lib/utils";

export function suggestionReason(item: RatingSuggestion): string {
	if (item.ratings_count === 0)
		return "Станьте першими, хто поділиться досвідом";
	if (item.ratings_count <= 3)
		return "Тут ще мало оцінок. Ваш досвід особливо потрібен";
	return "Ви слухали цю дисципліну. Поділіться враженнями";
}

interface RatingSuggestionsProps {
	readonly items: readonly RatingSuggestion[];
	readonly onSelect: (item: RatingSuggestion) => void;
	readonly compact?: boolean;
	readonly stacked?: boolean;
}

export function RatingSuggestions({
	items,
	onSelect,
	compact = false,
	stacked = false,
}: RatingSuggestionsProps) {
	return (
		<div className={cn("grid gap-3", !compact && !stacked && "sm:grid-cols-3")}>
			{items.map((item) => (
				<article
					key={item.course_offering_id}
					className={cn(
						"flex min-w-0 flex-col gap-3 rounded-xl bg-muted/50 p-4",
						compact &&
							!stacked &&
							"sm:flex-row sm:items-center sm:justify-between",
					)}
				>
					<div className="min-w-0 space-y-1">
						<h3 className="font-semibold leading-snug">
							{compact ? `Як вам «${item.course_title}»?` : item.course_title}
						</h3>
						<p className="text-xs text-muted-foreground">
							{getSemesterDisplay(item.semester.year, item.semester.season)}
						</p>
						<p className="text-sm text-muted-foreground">
							{suggestionReason(item)}
						</p>
					</div>
					<Button
						variant={compact ? "default" : "outline"}
						size="sm"
						className={cn("mt-auto", compact && !stacked && "shrink-0 sm:mt-0")}
						onClick={() => onSelect(item)}
						aria-label={`Оцінити «${item.course_title}»`}
					>
						Оцінити дисципліну <ArrowRight aria-hidden className="size-4" />
					</Button>
				</article>
			))}
		</div>
	);
}
