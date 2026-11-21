import { PenLine } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { getSemesterDisplay } from "@/lib/semester-term";
import { cn } from "@/lib/utils";
import type { RatingSuggestion } from "@/lib/api/generated";

interface RatingSuggestionsProps {
	readonly items: readonly RatingSuggestion[];
	readonly onSelect: (item: RatingSuggestion) => void;
	readonly highlight?: boolean;
	readonly className?: string;
}

export function RatingSuggestions({
	items,
	onSelect,
	highlight = false,
	className,
}: RatingSuggestionsProps) {
	return (
		<div className={cn("grid gap-3", className)}>
			{items.map((item) => (
				<article
					key={item.course_offering_id}
					className={cn(
						"flex min-w-0 items-center justify-between gap-3 rounded-xl p-4",
						highlight ? "border border-primary/20 bg-primary/5" : "bg-muted/50",
					)}
				>
					<div className="min-w-0 space-y-0.5">
						<h3 className="line-clamp-2 font-medium leading-snug">
							{item.course_title}
						</h3>
						<p className="text-sm text-muted-foreground">
							{getSemesterDisplay(item.semester.year, item.semester.season)}
						</p>
					</div>
					<Button
						size="sm"
						className="min-h-10 shrink-0 px-4 sm:min-h-0"
						onClick={() => onSelect(item)}
						aria-label={`Оцінити «${item.course_title}»`}
					>
						<PenLine className="size-3.5" aria-hidden />
						Оцінити
					</Button>
				</article>
			))}
		</div>
	);
}
