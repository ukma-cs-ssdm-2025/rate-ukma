import type {
	ComponentProps,
	CSSProperties,
	MouseEvent,
	ReactNode,
} from "react";

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

const ROW_CLICK_IGNORE_SELECTOR =
	'a,button,input,select,textarea,label,[role="button"],[role="link"],[contenteditable],[data-row-click-ignore="true"]';

function isModifiedClick(event: MouseEvent): boolean {
	return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function hasActiveTextSelection(): boolean {
	const selection = globalThis.getSelection?.();
	return Boolean(selection?.type === "Range" && selection.toString().trim());
}

function shouldIgnoreRowClickTarget(target: EventTarget | null): boolean {
	return target instanceof HTMLElement
		? Boolean(target.closest(ROW_CLICK_IGNORE_SELECTOR))
		: false;
}

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
		backgroundColor: isPinned ? "inherit" : undefined,
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

interface DataTableProps<TData> extends ComponentProps<"div"> {
	table: TanstackTable<TData>;
	actionBar?: ReactNode;
	totalRows?: number;
	serverPageCount?: number;
	emptyStateMessage: string;
	emptyStateTestId?: string;
	onRowClick?: (row: TData) => void;
	isRowHighlighted?: (row: TData) => boolean;
}

export function DataTable<TData>({
	table,
	actionBar,
	children,
	className,
	totalRows,
	serverPageCount,
	emptyStateMessage,
	emptyStateTestId,
	onRowClick,
	isRowHighlighted,
	...props
}: Readonly<DataTableProps<TData>>) {
	const tableTestId =
		typeof props["data-testid"] === "string" ? props["data-testid"] : undefined;
	const rowTestId = tableTestId ? `${tableTestId}-row` : undefined;

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
								return (
									<TableRow
										key={row.id}
										data-testid={rowTestId}
										data-state={row.getIsSelected() && "selected"}
										data-highlighted={highlighted ? true : undefined}
										data-clickable={onRowClick ? true : undefined}
										className={cn(onRowClick && "group")}
										onClick={(event) => {
											if (!onRowClick) return;
											if (isModifiedClick(event)) return;
											if (hasActiveTextSelection()) return;
											if (shouldIgnoreRowClickTarget(event.target)) return;

											onRowClick(row.original);
										}}
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell
												key={cell.id}
												style={{
													...getCommonPinningStyles({ column: cell.column }),
												}}
												className={getAlignmentClass(
													cell.column.columnDef.meta,
												)}
											>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
								);
							})
						) : (
							<TableRow>
								<TableCell
									colSpan={table.getAllColumns().length}
									className="h-24 text-center"
									data-testid={emptyStateTestId}
								>
									{emptyStateMessage}
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
