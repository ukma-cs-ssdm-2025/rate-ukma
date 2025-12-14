import type { Table } from "@tanstack/react-table";
import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";

interface DataTablePaginationProps<TData> extends React.ComponentProps<"div"> {
	table: Table<TData>;
	pageSizeOptions?: number[];
	totalRows?: number;
	serverPageCount?: number;
}

export function DataTablePagination<TData>({
	table,
	pageSizeOptions = [10, 20, 30, 40, 50],
	totalRows,
	serverPageCount,
	className,
	...props
}: Readonly<DataTablePaginationProps<TData>>) {
	return (
		<div
			data-testid={testIds.common.pagination}
			className={cn(
				"flex w-full flex-col gap-3 px-1 py-2 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-0 sm:text-sm",
				className,
			)}
			{...props}
		>
			<div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto">
				<p className="font-medium">Рядків на сторінці</p>
				<Select
					value={`${table.getState().pagination.pageSize}`}
					onValueChange={(value) => {
						table.setPageSize(Number(value));
					}}
				>
					<SelectTrigger className="h-8 w-[4.5rem] [&[data-size]]:h-8">
						<SelectValue placeholder={table.getState().pagination.pageSize} />
					</SelectTrigger>
					<SelectContent side="top">
						{pageSizeOptions.map((pageSize) => (
							<SelectItem key={pageSize} value={`${pageSize}`}>
								{pageSize}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto">
				<div
					className="font-medium"
					data-testid={testIds.common.paginationLabel}
				>
					Сторінка {table.getState().pagination.pageIndex + 1} з{" "}
					{serverPageCount ?? table.getPageCount()}
				</div>

				<div className="flex gap-2">
					<Button
						aria-label="Go to first page"
						data-testid={testIds.common.paginationFirst}
						variant="outline"
						size="icon"
						className="hidden size-8 lg:flex"
						onClick={() => table.setPageIndex(0)}
						disabled={!table.getCanPreviousPage()}
					>
						<ChevronsLeft />
					</Button>
					<Button
						aria-label="Go to previous page"
						data-testid={testIds.common.paginationPrevious}
						variant="outline"
						size="icon"
						className="size-8"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<ChevronLeft />
					</Button>
					<Button
						aria-label="Go to next page"
						data-testid={testIds.common.paginationNext}
						variant="outline"
						size="icon"
						className="size-8"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						<ChevronRight />
					</Button>
					<Button
						aria-label="Go to last page"
						data-testid={testIds.common.paginationLast}
						variant="outline"
						size="icon"
						className="hidden size-8 lg:flex"
						onClick={() => table.setPageIndex(table.getPageCount() - 1)}
						disabled={!table.getCanNextPage()}
					>
						<ChevronsRight />
					</Button>
				</div>
			</div>
		</div>
	);
}
