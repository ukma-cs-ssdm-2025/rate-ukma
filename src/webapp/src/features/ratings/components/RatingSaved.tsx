import { DialogDescription, DialogTitle } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import type { RatingSuggestion } from "../hooks/useRatingSuggestions";
import { RatingSuggestions } from "./RatingSuggestions";

interface RatingSavedProps {
	readonly suggestions: readonly RatingSuggestion[];
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly onSelect: (item: RatingSuggestion) => void;
}

function description({ suggestions, isLoading, isError }: RatingSavedProps) {
	if (isLoading || suggestions.length > 0) return "Хочете оцінити ще одну?";
	if (isError) return "Оцінку збережено.";
	return "Ви вже оцінили все доступне.";
}

export function RatingSaved(props: RatingSavedProps) {
	return (
		<div className="space-y-5">
			<div className="space-y-2 pr-5">
				<DialogTitle className="leading-snug">Дякуємо за оцінку!</DialogTitle>
				<DialogDescription>{description(props)}</DialogDescription>
			</div>
			{props.isLoading ? (
				<Skeleton className="h-40 w-full rounded-xl" />
			) : (
				<RatingSuggestions
					items={props.suggestions}
					onSelect={props.onSelect}
				/>
			)}
		</div>
	);
}
