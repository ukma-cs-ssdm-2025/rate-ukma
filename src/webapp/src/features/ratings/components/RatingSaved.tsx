import { ArrowRight, Check } from "lucide-react";

import { Link } from "@tanstack/react-router";

import { Button, buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { DialogDescription, DialogTitle } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import type { RatingSuggestion } from "@/lib/api/generated";
import { RatingSuggestions } from "./RatingSuggestions";

interface RatingSavedProps {
	readonly suggestions: readonly RatingSuggestion[];
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly onSelect: (item: RatingSuggestion) => void;
	readonly onClose: () => void;
	/** Set when the rated course is not the page the user is on. */
	readonly openCourse?: {
		readonly courseId: string;
		readonly name?: string;
		readonly onOpen: () => void;
	};
}

function description({ suggestions, isLoading, isError }: RatingSavedProps) {
	if (isLoading || suggestions.length > 0) {
		return "Хочете оцінити ще одну?";
	}
	if (isError) {
		return "Оцінку збережено.";
	}
	return "Ви вже оцінили все доступне.";
}

function SavedCourse({
	courseId,
	name,
	onOpen,
}: NonNullable<RatingSavedProps["openCourse"]>) {
	const label = name ? `«${name}»` : "дисципліну";
	return (
		<article className="flex min-w-0 items-center justify-between gap-3 rounded-xl border p-4">
			<div className="min-w-0 space-y-0.5">
				<h3 className="line-clamp-2 font-medium leading-snug">
					{name ?? "Дисципліна"}
				</h3>
				<p className="flex items-center gap-1 text-sm text-muted-foreground">
					<Check className="size-3.5" aria-hidden />
					Оцінено
				</p>
			</div>
			<Link
				to="/courses/$courseId"
				params={{ courseId }}
				className={cn(
					buttonVariants({ size: "sm", variant: "outline" }),
					"min-h-10 shrink-0 px-4 sm:min-h-0",
				)}
				aria-label={`Відкрити ${label}`}
				onClick={(event) => {
					// A new-tab click leaves this tab, and the thanks, where they are.
					if (
						event.button !== 0 ||
						event.metaKey ||
						event.ctrlKey ||
						event.shiftKey ||
						event.altKey
					) {
						return;
					}
					onOpen();
				}}
			>
				Відкрити
				<ArrowRight className="size-3.5" aria-hidden />
			</Link>
		</article>
	);
}

export function RatingSaved(props: RatingSavedProps) {
	const hasNext = props.isLoading || props.suggestions.length > 0;
	return (
		<div className="space-y-5">
			<div className="space-y-2 pr-5">
				<DialogTitle className="leading-snug">Дякуємо за оцінку!</DialogTitle>
				{!props.openCourse && (
					<DialogDescription>{description(props)}</DialogDescription>
				)}
			</div>
			{props.openCourse && <SavedCourse {...props.openCourse} />}
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
