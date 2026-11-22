import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

export function DataLines({
	label,
	children,
	empty = false,
}: Readonly<{ label: string; children: React.ReactNode; empty?: boolean }>) {
	return (
		<ul
			aria-label={label}
			className={cn(
				"divide-y overflow-hidden rounded-xl border bg-card",
				empty && "hidden",
			)}
		>
			{children}
		</ul>
	);
}

export function DataLine({
	title,
	effect,
	chip,
	action,
}: Readonly<{
	title: string;
	effect: React.ReactNode;
	chip?: React.ReactNode;
	action?: React.ReactNode;
}>) {
	return (
		<li className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
			<div className="min-w-0 max-w-3xl space-y-1.5">
				<h3 className="text-lg font-semibold">{title}</h3>
				<p className="text-sm text-muted-foreground">{effect}</p>
				{chip}
			</div>
			{action ? (
				<div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
					{action}
				</div>
			) : null}
		</li>
	);
}

export function DataDoneLine({
	title,
	detail,
	action,
}: Readonly<{
	title: string;
	detail: React.ReactNode;
	action?: React.ReactNode;
}>) {
	return (
		<li className="flex flex-col gap-2 bg-tint-success px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
			<div className="space-y-1">
				<h3 className="text-lg font-semibold text-tint-success-foreground">
					{title}
				</h3>
				<p className="text-sm text-muted-foreground">{detail}</p>
			</div>
			{action}
		</li>
	);
}

export function DataLinesSkeleton() {
	return (
		<div className="space-y-3" aria-busy="true" aria-label="Завантаження">
			<Skeleton className="h-16 rounded-lg" />
			{Array.from({ length: 3 }, (_, index) => (
				<Skeleton key={index} className="h-28 rounded-lg" />
			))}
		</div>
	);
}
