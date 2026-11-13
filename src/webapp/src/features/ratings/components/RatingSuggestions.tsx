import { Button } from "@/components/ui/Button";
import { getSemesterDisplay } from "@/features/courses/courseFormatting";
import { cn } from "@/lib/utils";
import type { RatingSuggestion } from "../hooks/useRatingSuggestions";

interface RatingSuggestionsProps {
	readonly items: readonly RatingSuggestion[];
	readonly onSelect: (item: RatingSuggestion) => void;
	readonly className?: string;
}

export function RatingSuggestions({
	items,
	onSelect,
	className,
}: RatingSuggestionsProps) {
	return (
		<div className={cn("grid gap-3", className)}>
			{items.map((item) => (
				<article
					key={item.course_offering_id}
					className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/50 p-4"
				>
					<div className="min-w-0 space-y-1">
						<h3 className="font-semibold leading-snug">{item.course_title}</h3>
						<p className="text-sm text-muted-foreground">
							{getSemesterDisplay(item.semester.year, item.semester.season)}
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						className="mt-auto"
						onClick={() => onSelect(item)}
						aria-label={`Оцінити «${item.course_title}»`}
					>
						Оцінити
					</Button>
				</article>
			))}
		</div>
	);
}
