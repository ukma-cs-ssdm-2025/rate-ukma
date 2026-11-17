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

export function RatingSaved(props: RatingSavedProps) {
	const hasNext = props.isLoading || props.suggestions.length > 0;
	return (
		<div className="space-y-5">
			<div className="space-y-2 pr-5">
				<DialogTitle className="leading-snug">Дякуємо за оцінку!</DialogTitle>
				<DialogDescription>{description(props)}</DialogDescription>
			</div>
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
			<div className="space-y-2">
				{props.openCourse && (
					<Button
						variant={hasNext ? "outline" : "default"}
						className="w-full"
						onClick={props.openCourse.onOpen}
					>
						<span className="truncate">
							{props.openCourse.name
								? `Відкрити «${props.openCourse.name}»`
								: "Відкрити дисципліну"}
						</span>
					</Button>
				)}
				<Button
					variant={hasNext || props.openCourse ? "ghost" : "default"}
					className="w-full"
					onClick={props.onClose}
				>
					{hasNext ? "Не зараз" : "Готово"}
				</Button>
			</div>
		</div>
	);
}
