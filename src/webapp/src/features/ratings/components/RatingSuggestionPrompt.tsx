import { useState } from "react";

import type { RatingSuggestion } from "../hooks/useRatingSuggestions";
import { useRatingSuggestions } from "../hooks/useRatingSuggestions";
import { RatingModal } from "./RatingModal";
import { RatingSuggestions } from "./RatingSuggestions";

interface RatingSuggestionPromptProps {
	readonly compact?: boolean;
	readonly excludeCourse?: string;
	readonly stacked?: boolean;
}

export function RatingSuggestionPrompt({
	compact = false,
	excludeCourse,
	stacked = false,
}: RatingSuggestionPromptProps) {
	const { data: suggestions } = useRatingSuggestions(excludeCourse);
	const [selected, setSelected] = useState<RatingSuggestion | null>(null);
	const items = compact ? suggestions?.slice(0, 1) : suggestions;

	return (
		<>
			{items && items.length > 0 && (
				<section aria-label="Дисципліни до оцінювання" className="space-y-3">
					{!compact && (
						<div className="space-y-1">
							<h2 className="text-lg font-semibold">З чого почнемо?</h2>
							<p className="text-sm text-muted-foreground">
								Оберіть дисципліну, яку пам’ятаєте найкраще.
							</p>
						</div>
					)}
					<RatingSuggestions
						items={items}
						onSelect={setSelected}
						compact={compact}
						stacked={stacked}
					/>
				</section>
			)}
			{selected && (
				<RatingModal
					isOpen
					onClose={() => setSelected(null)}
					courseId={selected.course_id}
					offeringId={selected.course_offering_id}
					courseName={selected.course_title}
				/>
			)}
		</>
	);
}
