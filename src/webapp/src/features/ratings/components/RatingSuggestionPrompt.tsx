import { useId, useState } from "react";

import { cn } from "@/lib/utils";
import { useRatingFlowEnabled } from "../hooks/useRatingFlowEnabled";
import { useRatingSuggestions } from "../hooks/useRatingSuggestions";
import type { RatingSuggestion } from "../hooks/useRatingSuggestions";
import { RatingModal } from "./RatingModal";
import { RatingSuggestions } from "./RatingSuggestions";

interface RatingSuggestionPromptProps {
	readonly excludeCourse?: string;
	readonly className?: string;
}

export function RatingSuggestionPrompt({
	excludeCourse,
	className,
}: RatingSuggestionPromptProps) {
	const titleId = useId();
	const flowEnabled = useRatingFlowEnabled();
	const { data } = useRatingSuggestions(excludeCourse);
	const [selected, setSelected] = useState<RatingSuggestion | null>(null);
	const items = data?.slice(0, 1) ?? [];

	if (!flowEnabled) {
		return null;
	}

	return (
		<>
			{items.length > 0 && (
				<section
					aria-labelledby={titleId}
					className={cn("space-y-3", className)}
				>
					<h2 id={titleId} className="text-lg font-semibold">
						Що оцінити далі
					</h2>
					<RatingSuggestions items={items} onSelect={setSelected} highlight />
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
