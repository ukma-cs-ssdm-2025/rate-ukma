import type * as React from "react";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface CourseColumnHeaderProps<TData, TValue> {
	column: Column<TData, TValue>;
	title: string;
}

export function CourseColumnHeader<TData, TValue>({
	column,
	title,
}: CourseColumnHeaderProps<TData, TValue>) {
	const sortState = column.getIsSorted() as false | "asc" | "desc";

	const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		if (!column.getCanSort()) {
			return;
		}

		const isMultiSort = event.shiftKey;

		if (sortState === "asc") {
			column.toggleSorting(true, isMultiSort);
		} else if (sortState === "desc") {
			column.clearSorting();
		} else {
			column.toggleSorting(false, isMultiSort);
		}
	};

	const Icon =
		sortState === "asc"
			? ArrowUp
			: sortState === "desc"
				? ArrowDown
				: ArrowUpDown;

	const sortHintText =
		sortState === "asc"
			? "Сортувати за спаданням"
			: sortState === "desc"
				? "Скинути сортування"
				: "Сортувати за зростанням";

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
