import type * as React from "react";

import {
	type Column,
	flexRender,
	type Table as TanstackTable,
} from "@tanstack/react-table";

import { DataTablePagination } from "@/components/DataTable/DataTablePagination";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/Table";
import { cn } from "@/lib/utils";

export function getCommonPinningStyles<TData>({
	column,
	withBorder = false,
}: {
	column: Column<TData>;
	withBorder?: boolean;
}): React.CSSProperties {
	const isPinned = column.getIsPinned();
	const isLastLeftPinnedColumn =
		isPinned === "left" && column.getIsLastColumn("left");
	const isFirstRightPinnedColumn =
		isPinned === "right" && column.getIsFirstColumn("right");

	return {
		boxShadow: withBorder
			? isLastLeftPinnedColumn
				? "-4px 0 4px -4px var(--border) inset"
				: isFirstRightPinnedColumn
					? "4px 0 4px -4px var(--border) inset"
					: undefined
			: undefined,
		left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
		right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
		opacity: isPinned ? 0.97 : 1,
		position: isPinned ? "sticky" : "relative",
		background: isPinned ? "var(--background)" : "var(--background)",
		width: column.getSize(),
		zIndex: isPinned ? 1 : 0,
	};
}

interface DataTableProps<TData> extends React.ComponentProps<"div"> {
	table: TanstackTable<TData>;
	actionBar?: React.ReactNode;
	onRowClick?: (row: TData) => void;
	totalRows?: number;
	serverPageCount?: number;
}

export function DataTable<TData>({
	table,
	actionBar,
	children,
	className,
	onRowClick,
	totalRows,
	serverPageCount,
	...props
}: DataTableProps<TData>) {
	return (
		<div
			className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
			{...props}
		>
			{children}
			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										colSpan={header.colSpan}
										style={{
											...getCommonPinningStyles({ column: header.column }),
										}}
										className={
											(header.column.columnDef.meta as { align?: string })
												?.align === "center"
												? "text-center"
												: (header.column.columnDef.meta as { align?: string })
															?.align === "right"
													? "text-right"
													: "text-left"
										}
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									className={onRowClick ? "cursor-pointer" : ""}
									onClick={() => onRowClick?.(row.original)}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											style={{
												...getCommonPinningStyles({ column: cell.column }),
											}}
											className={
												(cell.column.columnDef.meta as { align?: string })
													?.align === "center"
													? "text-center"
													: (cell.column.columnDef.meta as { align?: string })
																?.align === "right"
														? "text-right"
														: "text-left"
											}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={table.getAllColumns().length}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex flex-col gap-2.5">
				<DataTablePagination 
					table={table} 
					totalRows={totalRows}
					serverPageCount={serverPageCount}
				/>
				{actionBar &&
					table.getFilteredSelectedRowModel().rows.length > 0 &&
					actionBar}
			</div>
		</div>
	);
}
