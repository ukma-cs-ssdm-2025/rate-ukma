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

// Modifier-key clicks typically mean "do something else" (e.g. open in new tab, multi-select),
// so row navigation should not trigger in those cases.
function isModifiedClick(event: MouseEvent): boolean {
	return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

// Avoid navigating when the user is selecting text (e.g. to copy a course title).
function hasActiveTextSelection(): boolean {
	const selection = globalThis.getSelection?.();
	if (!selection) return false;

	const text = selection.toString().trim();
	if (text.length === 0) return false;

	return selection.type === "Range" || selection.isCollapsed === false;
}

function shouldIgnoreRowClickTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return Boolean(target.closest(ROW_CLICK_IGNORE_SELECTOR));
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
		background: isPinned ? "var(--background)" : undefined,
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
	onRowClick?: (row: TData) => void;
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
								return (
									<TableRow
										key={row.id}
										data-state={row.getIsSelected() && "selected"}
										data-highlighted={highlighted ? true : undefined}
										className={cn(
											onRowClick && "group cursor-pointer",
											highlighted && "hover:bg-primary/5",
										)}
										onClick={(event) => {
											if (!onRowClick) return;
											if (event.defaultPrevented) return;
											if (isModifiedClick(event)) return;
											if (hasActiveTextSelection()) return;
											if (shouldIgnoreRowClickTarget(event.target)) return;

											onRowClick(row.original);
										}}
									>
										{row.getVisibleCells().map((cell, cellIndex) => (
											<TableCell
												key={cell.id}
												style={{
													...getCommonPinningStyles({ column: cell.column }),
												}}
												className={cn(
													getAlignmentClass(cell.column.columnDef.meta),
													highlighted &&
														cellIndex === 0 &&
														"relative before:content-[''] before:absolute before:left-0 before:inset-y-0 before:w-0.5 before:bg-primary/60 before:transition-[width] before:duration-150 group-hover:before:w-1",
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
