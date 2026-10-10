import { useState } from "react";

import { DialogDescription, DialogTitle } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import type { RatingSuggestion } from "../hooks/useRatingSuggestions";
import { RatingComparison } from "./RatingComparison";
import { RatingSuggestions } from "./RatingSuggestions";
import {
	SemesterStoryTeaser,
	SemesterStoryView,
	type SemesterStoryData,
} from "./SemesterStory";

export interface SavedScores {
	readonly difficulty: number;
	readonly usefulness: number;
	readonly avgDifficulty?: number | null;
	readonly avgUsefulness?: number | null;
}

interface RatingSavedProps {
	readonly suggestions: readonly RatingSuggestion[];
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly onSelect: (item: RatingSuggestion) => void;
	readonly scores?: SavedScores;
	readonly story?: SemesterStoryData | null;
}

function description({ suggestions, isLoading, isError }: RatingSavedProps) {
	if (isLoading || suggestions.length > 0) return "Хочете оцінити ще одну?";
	if (isError) return "Оцінку збережено.";
	return "Ви вже оцінили все доступне.";
}

export function RatingSaved(props: RatingSavedProps) {
	const [storyOpen, setStoryOpen] = useState(false);
	if (props.story && storyOpen)
		return (
			<SemesterStoryView
				story={props.story}
				onBack={() => setStoryOpen(false)}
			/>
		);

	return (
		<div className="space-y-5">
			<div className="space-y-2 pr-5">
				<DialogTitle className="leading-snug">Дякуємо за оцінку!</DialogTitle>
				<DialogDescription>
					{props.scores ? "Ось як оцінили інші" : description(props)}
				</DialogDescription>
			</div>
			{props.scores && <RatingComparison {...props.scores} />}
			{props.story && (
				<SemesterStoryTeaser
					story={props.story}
					onOpen={() => setStoryOpen(true)}
				/>
			)}
			{props.isLoading ? (
				<Skeleton className="h-40 w-full rounded-xl" />
			) : props.suggestions.length > 0 ? (
				<div className="space-y-3">
					{props.scores && (
						<h3 className="text-sm font-semibold">Хочете оцінити ще одну?</h3>
					)}
					<RatingSuggestions
						items={props.suggestions}
						onSelect={props.onSelect}
					/>
				</div>
			) : null}
		</div>
	);
}
