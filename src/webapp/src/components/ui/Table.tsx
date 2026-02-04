import type * as React from "react";

import { cn } from "@/lib/utils";

const tableRowBaseClassName =
	"border-b transition-colors duration-200 ease-out data-[state=selected]:bg-muted";
const tableRowClickableClassName =
	"data-[clickable=true]:cursor-pointer data-[clickable=true]:hover:bg-muted/50";
const tableRowClickableHighlightedHoverClassName =
	"data-[clickable=true]:data-[highlighted=true]:hover:bg-primary/10";
const tableRowHighlightedIndicatorBaseClassName =
	"data-[highlighted=true]:[&>td:first-child]:relative data-[highlighted=true]:[&>td:first-child]:before:content-[''] data-[highlighted=true]:[&>td:first-child]:before:absolute data-[highlighted=true]:[&>td:first-child]:before:inset-y-0 data-[highlighted=true]:[&>td:first-child]:before:left-0";
const tableRowHighlightedIndicatorStyleClassName =
	"data-[highlighted=true]:[&>td:first-child]:before:w-[4px] data-[highlighted=true]:[&>td:first-child]:before:bg-primary data-[highlighted=true]:[&>td:first-child]:before:rounded-r-sm";
const tableRowHighlightedIndicatorAnimClassName =
	"data-[highlighted=true]:[&>td:first-child]:before:origin-left data-[highlighted=true]:[&>td:first-child]:before:scale-x-[0.75] data-[highlighted=true]:[&>td:first-child]:before:transition-transform data-[highlighted=true]:[&>td:first-child]:before:duration-200 data-[highlighted=true]:[&>td:first-child]:before:ease-out";
const tableRowClickableHighlightedIndicatorHoverAnimClassName =
	"data-[clickable=true]:data-[highlighted=true]:hover:[&>td:first-child]:before:scale-x-100";

function Table({ className, ...props }: React.ComponentProps<"table">) {
	return (
		<div
			data-slot="table-container"
			className="relative w-full overflow-x-auto"
		>
			<table
				data-slot="table"
				className={cn(
					"w-full caption-bottom text-xs sm:text-sm md:table-fixed",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return (
		<thead
			data-slot="table-header"
			className={cn("[&_tr]:border-b", className)}
			{...props}
		/>
	);
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return (
		<tbody
			data-slot="table-body"
			className={cn("[&_tr:last-child]:border-b-0", className)}
			{...props}
		/>
	);
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
	return (
		<tfoot
			data-slot="table-footer"
			className={cn(
				"bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
				className,
			)}
			{...props}
		/>
	);
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
	return (
		<tr
			data-slot="table-row"
			className={cn(
				tableRowBaseClassName,
				tableRowClickableClassName,
				tableRowClickableHighlightedHoverClassName,
				tableRowHighlightedIndicatorBaseClassName,
				tableRowHighlightedIndicatorStyleClassName,
				tableRowHighlightedIndicatorAnimClassName,
				tableRowClickableHighlightedIndicatorHoverAnimClassName,
				className,
			)}
			{...props}
		/>
	);
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				"text-foreground h-14 px-4 text-left align-middle font-semibold text-xs md:text-sm whitespace-normal break-words sm:whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
				className,
			)}
			{...props}
		/>
	);
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				"p-4 align-middle whitespace-normal break-words text-xs md:text-sm sm:whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
				className,
			)}
			{...props}
		/>
	);
}

function TableCaption({
	className,
	...props
}: React.ComponentProps<"caption">) {
	return (
		<caption
			data-slot="table-caption"
			className={cn("text-muted-foreground mt-4 text-sm", className)}
			{...props}
		/>
	);
}

export {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
};
