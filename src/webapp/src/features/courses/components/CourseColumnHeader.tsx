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
		const isInitialAsc = initialSortDirection === "asc";

		if (sortState === false) {
			column.toggleSorting(!isInitialAsc, isMultiSort);
			return;
		}

		if (sortState === "asc") {
			if (isInitialAsc) {
				column.toggleSorting(true, isMultiSort);
			} else {
				column.clearSorting();
			}
			return;
		}

		if (sortState === "desc") {
			if (isInitialAsc) {
				column.clearSorting();
			} else {
				column.toggleSorting(false, isMultiSort);
			}
		}
	};

	const getSortIcon = () => {
		if (sortState === "asc") return ArrowUp;
		if (sortState === "desc") return ArrowDown;
		return ArrowUpDown;
	};

	const getSortHintText = () => {
		const isInitialAsc = initialSortDirection === "asc";

		if (sortState === false) {
			if (isInitialAsc) {
				return "Сортувати за зростанням";
			}
			return "Сортувати за спаданням";
		}

		if (sortState === "asc") {
			if (isInitialAsc) {
				return "Сортувати за спаданням";
			}
			return "Скинути сортування";
		}

		if (isInitialAsc) {
			return "Скинути сортування";
		}
		return "Сортувати за зростанням";
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
