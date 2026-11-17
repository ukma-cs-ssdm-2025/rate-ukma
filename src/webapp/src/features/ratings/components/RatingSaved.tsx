import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { DialogDescription, DialogTitle } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import type { RatingSuggestion } from "../hooks/useRatingSuggestions";
import { RatingSuggestions } from "./RatingSuggestions";

interface RatingSavedProps {
	readonly suggestions: readonly RatingSuggestion[];
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly onSelect: (item: RatingSuggestion) => void;
	readonly onClose: () => void;
	/** Set when the rated course is not the page the user is on. */
	readonly openCourse?: {
		readonly name?: string;
		readonly onOpen: () => void;
	};
}

function description({ suggestions, isLoading, isError }: RatingSavedProps) {
	if (isLoading || suggestions.length > 0) return "Хочете оцінити ще одну?";
	if (isError) return "Оцінку збережено.";
	return "Ви вже оцінили все доступне.";
}

function SavedCourse({
	name,
	onOpen,
}: NonNullable<RatingSavedProps["openCourse"]>) {
	const label = name ? `«${name}»` : "дисципліну";
	return (
		<p className="text-muted-foreground text-sm">
			Оцінку {name ? `для ${label} ` : ""}збережено.{" "}
			<button
				type="button"
				className="text-primary inline-flex items-center gap-0.5 font-medium hover:underline focus-visible:underline focus-visible:outline-none"
				aria-label={`Відкрити ${label}`}
				onClick={onOpen}
			>
				Відкрити
				<ArrowRight className="size-3.5" aria-hidden />
			</button>
		</p>
	);
}

export function RatingSaved(props: RatingSavedProps) {
	const hasNext = props.isLoading || props.suggestions.length > 0;
	return (
		<div className="space-y-5">
			<div className="space-y-2 pr-5">
				<DialogTitle className="leading-snug">Дякуємо за оцінку!</DialogTitle>
				{props.openCourse ? (
					<SavedCourse {...props.openCourse} />
				) : (
					<DialogDescription>{description(props)}</DialogDescription>
				)}
			</div>
			{/* With the saved line above, the question opens its own block. */}
			{(props.openCourse || hasNext) && (
				<div className="space-y-3">
					{props.openCourse && (
						<DialogDescription>{description(props)}</DialogDescription>
					)}
					{props.isLoading ? (
						<Skeleton className="h-40 w-full rounded-xl" />
					) : (
						props.suggestions.length > 0 && (
							<RatingSuggestions
								items={props.suggestions}
								onSelect={props.onSelect}
							/>
						)
					)}
				</div>
			)}
			<Button
				variant={hasNext ? "ghost" : "default"}
				className="w-full"
				onClick={props.onClose}
			>
				{hasNext ? "Не зараз" : "Готово"}
			</Button>
		</div>
	);
}
