import type * as React from "react";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface CourseColumnHeaderProps<TData, TValue> {
	column: Column<TData, TValue>;
	title: string;
	initialSortDirection?: "asc" | "desc";
}

export function CourseColumnHeader<TData, TValue>({
	column,
	title,
	initialSortDirection = "asc",
}: Readonly<CourseColumnHeaderProps<TData, TValue>>) {
	const sortState = column.getIsSorted() as false | "asc" | "desc";

	const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		if (!column.getCanSort()) {
			return;
		}

		const isMultiSort = event.shiftKey;

		// Cycle based on initial direction:
		// If initialSortDirection is "asc": unsorted → asc → desc → unsorted
		// If initialSortDirection is "desc": unsorted → desc → asc → unsorted

		if (initialSortDirection === "asc") {
			// Standard cycle: asc → desc → unsorted
			if (sortState === "asc") {
				column.toggleSorting(true, isMultiSort); // Switch to desc
			} else if (sortState === "desc") {
				column.clearSorting(); // Clear
			} else {
				column.toggleSorting(false, isMultiSort); // Start with asc
			}
		} else {
			// Reverse cycle: desc → asc → unsorted
			if (sortState === "desc") {
				column.toggleSorting(false, isMultiSort); // Switch to asc
			} else if (sortState === "asc") {
				column.clearSorting(); // Clear
			} else {
				column.toggleSorting(true, isMultiSort); // Start with desc
			}
		}
	};

	const getSortIcon = () => {
		if (sortState === "asc") return ArrowUp;
		if (sortState === "desc") return ArrowDown;
		return ArrowUpDown;
	};

	const getSortHintText = () => {
		if (initialSortDirection === "asc") {
			// Standard cycle: asc → desc → unsorted
			if (sortState === "asc") return "Сортувати за спаданням";
			if (sortState === "desc") return "Скинути сортування";
			return "Сортувати за зростанням";
		} else {
			// Reverse cycle: desc → asc → unsorted
			if (sortState === "desc") return "Сортувати за зростанням";
			if (sortState === "asc") return "Скинути сортування";
			return "Сортувати за спаданням";
		}
	};

	const Icon = getSortIcon();
	const sortHintText = getSortHintText();

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="-ml-2 inline-flex h-8 items-center gap-2 px-2 text-sm font-medium"
			onClick={handleClick}
			disabled={!column.getCanSort()}
			title={sortHintText}
			aria-label={sortHintText}
		>
			<span>{title}</span>
			{column.getCanSort() ? <Icon className="h-4 w-4" /> : null}
		</Button>
	);
}
