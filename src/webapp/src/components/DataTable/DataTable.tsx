import type { ComponentProps, CSSProperties, ReactNode } from "react";

import type { LinkProps } from "@tanstack/react-router";
import {
	type Column,
	flexRender,
	type Table as TanstackTable,
} from "@tanstack/react-table";

import { DataTablePagination } from "@/components/DataTable/DataTablePagination";
import { NavigableTableRow } from "@/components/NavigableTableRow";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/Table";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
	// biome-ignore lint: Required by TanStack Table interface signature
	interface ColumnMeta<TData, TValue> {
		align?: "left" | "center" | "right";
		label?: string;
		placeholder?: string;
		variant?: "text" | "number";
		icon?: React.ComponentType<{ className?: string }>;
		range?: [number, number];
	}
}

export function getCommonPinningStyles<TData>({
	column,
	withBorder = false,
}: {
	column: Column<TData>;
	withBorder?: boolean;
}): CSSProperties {
	const isPinned = column.getIsPinned();
	const isLastLeftPinnedColumn =
		isPinned === "left" && column.getIsLastColumn("left");
	const isFirstRightPinnedColumn =
		isPinned === "right" && column.getIsFirstColumn("right");

	let boxShadow: string | undefined;
	if (withBorder && isLastLeftPinnedColumn) {
		boxShadow = "-4px 0 4px -4px var(--border) inset";
	} else if (withBorder && isFirstRightPinnedColumn) {
		boxShadow = "4px 0 4px -4px var(--border) inset";
	}

	return {
		boxShadow,
		left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
		right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
		opacity: isPinned ? 0.97 : 1,
		position: isPinned ? "sticky" : "relative",
		background: "var(--background)",
		width: column.getSize(),
		zIndex: isPinned ? 1 : 0,
	};
}

function getAlignmentClass<TData, TValue>(
	meta?: import("@tanstack/react-table").ColumnMeta<TData, TValue>,
): string {
	const align = meta?.align;
	if (align === "center") {
		return "text-center";
	}
	if (align === "right") {
		return "text-right";
	}
	return "text-left";
}

interface RowLinkConfig<TTo extends string = string> {
	to: TTo;
	params?: LinkProps<"to", TTo, never>["params"];
	search?: LinkProps<"to", TTo, never>["search"];
}

interface DataTableProps<TData> extends ComponentProps<"div"> {
	table: TanstackTable<TData>;
	actionBar?: ReactNode;
	onRowClick?: (row: TData) => void;
	getRowLink?: (row: TData) => RowLinkConfig | null;
	totalRows?: number;
	serverPageCount?: number;
	isRowHighlighted?: (row: TData) => boolean;
}

export function DataTable<TData>({
	table,
	actionBar,
	children,
	className,
	onRowClick,
	getRowLink,
	totalRows,
	serverPageCount,
	isRowHighlighted,
	...props
}: Readonly<DataTableProps<TData>>) {
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
										className={getAlignmentClass(header.column.columnDef.meta)}
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
							table.getRowModel().rows.map((row) => {
								const highlighted = isRowHighlighted?.(row.original) ?? false;
								const rowLink = getRowLink?.(row.original);

								const rowContent = row.getVisibleCells().map((cell) => (
									<TableCell
										key={cell.id}
										style={{
											...getCommonPinningStyles({ column: cell.column }),
										}}
										className={getAlignmentClass(cell.column.columnDef.meta)}
									>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								));

								if (rowLink) {
									return (
										<NavigableTableRow
											key={row.id}
											data-state={row.getIsSelected() && "selected"}
											to={rowLink.to}
											params={rowLink.params as never}
											search={rowLink.search as never}
											highlighted={highlighted}
										>
											{rowContent}
										</NavigableTableRow>
									);
								}

								return (
									<TableRow
										key={row.id}
										data-state={row.getIsSelected() && "selected"}
										data-highlighted={highlighted ? true : undefined}
										className={cn(
											onRowClick && "group cursor-pointer",
											highlighted &&
												"bg-primary/5 border-l-2 border-l-primary hover:bg-primary/10",
										)}
										onClick={() => onRowClick?.(row.original)}
									>
										{rowContent}
									</TableRow>
								);
							})
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
