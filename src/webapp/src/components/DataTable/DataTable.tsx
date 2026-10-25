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
import { Skeleton } from "@/components/ui/Skeleton";
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
	// Required by TanStack Table interface signature
	interface ColumnMeta<TData, TValue> {
		align?: "left" | "center" | "right";
		label?: string;
		placeholder?: string;
		variant?: "text" | "number";
		icon?: React.ComponentType<{ className?: string }>;
		range?: [number, number];
		// Hides the whole column below the sm breakpoint (CSS only, keeps DOM for tests).
		hideOnMobile?: boolean;
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
		backgroundColor: isPinned ? "var(--background)" : undefined,
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
	"data-testid"?: string;
	table: TanstackTable<TData>;
	actionBar?: ReactNode;
	totalRows?: number;
	serverPageCount?: number;
	emptyStateMessage: string;
	emptyStateTestId?: string;
	emptyStateAction?: ReactNode;
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
	emptyStateAction,
	onRowClick,
	isRowHighlighted,
	"data-testid": tableTestId,
	...props
}: Readonly<DataTableProps<TData>>) {
	const rowTestId = tableTestId ? `${tableTestId}-row` : undefined;

	return (
		<div
			className={cn("flex w-full flex-col gap-4 overflow-auto", className)}
			data-testid={tableTestId}
			{...props}
		>
			{children}
			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
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
										className={cn(
											getAlignmentClass(header.column.columnDef.meta),
											"max-sm:px-1.5",
											header.column.columnDef.meta?.hideOnMobile &&
												"hidden sm:table-cell",
										)}
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
												className={cn(
													getAlignmentClass(cell.column.columnDef.meta),
													"max-sm:px-1.5 max-sm:py-2",
													cell.column.columnDef.meta?.hideOnMobile &&
														"hidden sm:table-cell",
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
									className="text-center"
									data-testid={emptyStateTestId}
								>
									<div className="flex flex-col items-center gap-3 px-2 py-8">
										<p className="text-muted-foreground">{emptyStateMessage}</p>
										{emptyStateAction}
									</div>
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

interface DataTableSkeletonProps extends React.ComponentProps<"div"> {
	columnCount: number;
	rowCount?: number;
	filterCount?: number;
	cellWidths?: string[];
	withViewOptions?: boolean;
	withPagination?: boolean;
	shrinkZero?: boolean;
}

export function DataTableSkeleton({
	columnCount,
	rowCount = 10,
	filterCount = 0,
	cellWidths = ["auto"],
	withViewOptions = true,
	withPagination = true,
	shrinkZero = false,
	className,
	...props
}: Readonly<DataTableSkeletonProps>) {
	const cozyCellWidths = Array.from(
		{ length: columnCount },
		(_, index) => cellWidths[index % cellWidths.length] ?? "auto",
	);

	return (
		<div
			className={cn("flex w-full flex-col gap-4 overflow-auto", className)}
			{...props}
		>
			{/* An empty toolbar would push the table below where it renders. */}
			{filterCount > 0 || withViewOptions ? (
				<div className="flex w-full items-center justify-between gap-2 overflow-auto p-1">
					<div className="flex flex-1 items-center gap-2">
						{Array.from({ length: filterCount }).map((_, i) => (
							<Skeleton
								key={`skeleton-filter-${String(i)}`}
								className="h-7 w-[4.5rem] border-dashed"
							/>
						))}
					</div>
					{withViewOptions ? (
						<Skeleton className="ml-auto hidden h-7 w-[4.5rem] lg:flex" />
					) : null}
				</div>
			) : null}
			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
				<Table>
					<TableHeader>
						{Array.from({ length: 1 }).map((_, i) => (
							<TableRow
								key={`skeleton-row-${String(i)}`}
								className="hover:bg-transparent"
							>
								{Array.from({ length: columnCount }).map((_, j) => (
									<TableHead
										key={`skeleton-head-${String(j)}`}
										style={{
											width: cozyCellWidths[j],
											minWidth: shrinkZero ? cozyCellWidths[j] : "auto",
										}}
									>
										<Skeleton
											className={j === 0 ? "h-4 w-24" : "mx-auto h-4 w-20"}
										/>
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{Array.from({ length: rowCount }).map((_, i) => (
							<TableRow
								key={`skeleton-row-${String(i)}`}
								className="hover:bg-transparent"
							>
								{Array.from({ length: columnCount }).map((_, j) => (
									<TableCell
										key={`skeleton-cell-${String(j)}`}
										style={{
											width: cozyCellWidths[j],
											minWidth: shrinkZero ? cozyCellWidths[j] : "auto",
										}}
									>
										<Skeleton
											className={j === 0 ? "h-5 w-3/4" : "mx-auto h-6 w-12"}
										/>
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			{withPagination ? (
				<div className="flex w-full items-center justify-between gap-4 overflow-auto p-1 sm:gap-8">
					<Skeleton className="h-7 w-40 shrink-0" />
					<div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
						<div className="flex items-center gap-2">
							<Skeleton className="h-7 w-24" />
							<Skeleton className="h-7 w-[4.5rem]" />
						</div>
						<div className="flex items-center justify-center font-medium text-sm">
							<Skeleton className="h-7 w-20" />
						</div>
						<div className="flex items-center gap-2">
							<Skeleton className="hidden size-7 lg:block" />
							<Skeleton className="size-7" />
							<Skeleton className="size-7" />
							<Skeleton className="hidden size-7 lg:block" />
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
