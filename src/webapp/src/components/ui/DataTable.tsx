import type * as React from "react";

import type { Table as TanStackTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

import { Spinner } from "@/components/ui/Spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/Table";

interface DataTableProps<TData> {
	table: TanStackTable<TData>;
	loading?: boolean;
	children?: React.ReactNode;
	onRowClick?: (data: TData) => void;
}

export function DataTable<TData>({
	table,
	loading = false,
	children,
	onRowClick,
}: DataTableProps<TData>) {
	return (
		<div className="space-y-4">
			{children}
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									return (
										<TableHead key={header.id}>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									className="cursor-pointer hover:bg-muted/50"
									onClick={() => {
										if (onRowClick) {
											onRowClick(row.original);
										}
									}}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
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
									{loading ? (
										<div className="flex items-center justify-center">
											<Spinner className="mr-2 h-4 w-4" />
											Loading...
										</div>
									) : (
										<div>No results.</div>
									)}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
