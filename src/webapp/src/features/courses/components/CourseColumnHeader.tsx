import type * as React from "react";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type SortState = "asc" | "desc" | "none";

const SORT_ICONS: Record<SortState, typeof ArrowUpDown> = {
	asc: ArrowUp,
	desc: ArrowDown,
	none: ArrowUpDown,
};

// Clicks cycle initial direction → the other direction → unsorted.
const SORT_HINTS: Record<"asc" | "desc", Record<SortState, string>> = {
	asc: {
		none: "Сортувати за зростанням",
		asc: "Сортувати за спаданням",
		desc: "Скинути сортування",
	},
	desc: {
		none: "Сортувати за спаданням",
		desc: "Сортувати за зростанням",
		asc: "Скинути сортування",
	},
};

interface CourseColumnHeaderProps<TData, TValue> {
	column: Column<TData, TValue>;
	title: string;
	initialSortDirection?: "asc" | "desc";
	testId?: string;
	align?: "left" | "center";
	className?: string;
}

export function CourseColumnHeader<TData, TValue>({
	column,
	title,
	initialSortDirection = "asc",
	testId,
	align = "left",
	className,
}: Readonly<CourseColumnHeaderProps<TData, TValue>>) {
	if (!column.getCanSort()) {
		return (
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className={cn(
					"inline-flex h-8 items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground disabled:opacity-100",
					align === "left" && "-ml-2",
					className,
				)}
				disabled
				aria-label={title}
				data-testid={testId}
			>
				<span>{title}</span>
			</Button>
		);
	}

	const sortState = column.getIsSorted() || "none";
	const Icon = SORT_ICONS[sortState];
	const sortHintText = SORT_HINTS[initialSortDirection][sortState];

	const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		if (sortState === "none") {
			column.toggleSorting(initialSortDirection === "desc", event.shiftKey);
		} else if (sortState === initialSortDirection) {
			column.toggleSorting(sortState === "asc", event.shiftKey);
		} else {
			column.clearSorting();
		}
	};

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className={cn(
				"inline-flex h-8 items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
				align === "left" && "-ml-2",
				className,
			)}
			onClick={handleClick}
			title={sortHintText}
			aria-label={sortHintText}
			data-testid={testId}
		>
			<span>{title}</span>
			<Icon className="size-4" />
		</Button>
	);
}
