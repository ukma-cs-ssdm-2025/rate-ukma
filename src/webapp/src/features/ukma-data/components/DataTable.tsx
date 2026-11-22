import { Search } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

export function DataSearch({
	value,
	placeholder,
	onChange,
	className,
}: Readonly<{
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
	className?: string;
}>) {
	return (
		<div className={cn("relative min-w-0 flex-1", className)}>
			<Search
				aria-hidden
				className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				type="search"
				value={value}
				aria-label={placeholder}
				placeholder={placeholder}
				onChange={(event) => onChange(event.target.value)}
				className="pl-9"
			/>
		</div>
	);
}

export function DataTableFrame({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			<table className="w-full table-fixed text-sm">{children}</table>
		</div>
	);
}

export function DataTh({
	children,
	className,
}: Readonly<{ children?: React.ReactNode; className?: string }>) {
	return (
		<th
			scope="col"
			className={cn(
				"bg-muted px-4 py-3 text-left font-medium text-muted-foreground",
				className,
			)}
		>
			{children}
		</th>
	);
}

export function DataTd({
	children,
	className,
}: Readonly<{ children?: React.ReactNode; className?: string }>) {
	return (
		<td className={cn("px-4 py-3 align-top break-words", className)}>
			{children}
		</td>
	);
}

export function DataTitleCell({
	title,
	detail,
}: Readonly<{ title: string; detail: string }>) {
	return (
		<>
			<p>{title}</p>
			{detail ? <p className="text-muted-foreground">{detail}</p> : null}
		</>
	);
}

export function DataTableSkeleton() {
	return (
		<div className="space-y-2" aria-busy="true" aria-label="Завантаження">
			{Array.from({ length: 6 }, (_, index) => (
				<Skeleton key={index} className="h-14 rounded-md" />
			))}
		</div>
	);
}

export function DataTableEmpty({ children }: Readonly<{ children: string }>) {
	return (
		<p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
			{children}
		</p>
	);
}
