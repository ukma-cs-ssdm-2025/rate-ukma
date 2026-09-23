import type * as React from "react";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface CourseColumnHeaderProps<TData, TValue> {
	column: Column<TData, TValue>;
	title: string;
	initialSortDirection?: "asc" | "desc";
	testId?: string;
	align?: "left" | "right";
}

export function CourseColumnHeader<TData, TValue>({
	column,
	title,
	initialSortDirection = "asc",
	testId,
	align = "left",
}: Readonly<CourseColumnHeaderProps<TData, TValue>>) {
	if (!column.getCanSort()) {
		return (
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className={cn(
					"inline-flex h-8 items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground disabled:opacity-100",
					align === "right" ? "-mr-2" : "-ml-2",
				)}
				disabled
				aria-label={title}
				data-testid={testId}
			>
				<span>{title}</span>
			</Button>
		);
	}

	const sortState = column.getIsSorted() as false | "asc" | "desc";
	const isInitialAsc = initialSortDirection === "asc";
	const Icon =
		sortState === "asc"
			? ArrowUp
			: sortState === "desc"
				? ArrowDown
				: ArrowUpDown;
	const sortHintText =
		sortState === false
			? isInitialAsc
				? "Сортувати за зростанням"
				: "Сортувати за спаданням"
			: sortState === "asc"
				? isInitialAsc
					? "Сортувати за спаданням"
					: "Скинути сортування"
				: isInitialAsc
					? "Скинути сортування"
					: "Сортувати за зростанням";

	const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		const isMultiSort = event.shiftKey;

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

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className={cn(
				"inline-flex h-8 items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
				align === "right" ? "-mr-2" : "-ml-2",
			)}
			onClick={handleClick}
			disabled={!column.getCanSort()}
			title={sortHintText}
			aria-label={sortHintText}
			data-testid={testId}
		>
			<span>{title}</span>
			{column.getCanSort() ? <Icon className="h-4 w-4" /> : null}
		</Button>
	);
}
