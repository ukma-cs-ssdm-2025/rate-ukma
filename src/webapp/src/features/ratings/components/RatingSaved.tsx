import { CircleCheck } from "lucide-react";

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

export function RatingSaved({
	suggestions,
	isLoading,
	isError,
	onSelect,
}: RatingSavedProps) {
	return (
		<div className="space-y-5">
			<div className="space-y-2 pr-5">
				<DialogTitle className="flex items-center gap-2 leading-snug">
					<CircleCheck className="size-5 shrink-0 text-primary" aria-hidden />
					Дякуємо за вашу оцінку!
				</DialogTitle>
				<DialogDescription>
					Ваш досвід допоможе іншим обрати курс.
				</DialogDescription>
			</div>
			{isLoading ? (
				<Skeleton className="h-40 w-full rounded-xl" />
			) : suggestions.length > 0 ? (
				<section aria-label="Що оцінити далі" className="space-y-3">
					<h3 className="text-sm font-medium">Хочете оцінити ще одну?</h3>
					<RatingSuggestions items={suggestions} onSelect={onSelect} stacked />
				</section>
			) : !isError ? (
				<p className="text-sm text-muted-foreground">
					Усі доступні вам дисципліни вже оцінено.
				</p>
			) : null}
		</div>
	);
}
