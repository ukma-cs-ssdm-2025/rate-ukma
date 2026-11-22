import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { formatCount } from "../syncFormat";
import { arrowTarget, scrollToShow } from "../segmentScroll";
import { pageNumbers } from "../syncRows";

export type ChipTone = "success" | "primary" | "caution" | "muted";

const CHIP_TONES = {
	success: "bg-tint-success text-tint-success-foreground",
	primary: "bg-tint-primary text-tint-primary-foreground",
	caution: "bg-tint-caution text-tint-caution-foreground",
	muted: "bg-muted text-muted-foreground",
} satisfies Record<ChipTone, string>;

export function DataChip({
	tone,
	children,
}: Readonly<{ tone: ChipTone; children: React.ReactNode }>) {
	return (
		<span
			className={cn(
				"inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
				CHIP_TONES[tone],
			)}
		>
			<span aria-hidden className="size-1.5 rounded-full bg-current" />
			{children}
		</span>
	);
}

export function DataBack({
	onBack,
	children,
}: Readonly<{ onBack: () => void; children: React.ReactNode }>) {
	return (
		<button
			type="button"
			onClick={onBack}
			className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft className="size-4" />
			{children}
		</button>
	);
}

export function DataViewHead({
	title,
	children,
	action,
}: Readonly<{
	title: string;
	children?: React.ReactNode;
	action?: React.ReactNode;
}>) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div className="max-w-2xl space-y-1.5">
				<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
				{children ? (
					<p className="text-sm text-muted-foreground">{children}</p>
				) : null}
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	);
}

function useActiveInView(value: string) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const view = ref.current;
		const active = view?.querySelector<HTMLElement>("[data-active=true]");
		if (!view || !active) {
			return;
		}
		view.scrollLeft = scrollToShow(
			{ start: active.offsetLeft, size: active.offsetWidth },
			{ start: view.scrollLeft, size: view.clientWidth },
		);
	}, [value]);
	return ref;
}

export function DataSegments<T extends string>({
	label,
	items,
	value,
	onChange,
	tabs = false,
}: Readonly<{
	label: string;
	items: readonly { value: T; label: string; count?: number }[];
	value: T;
	onChange: (value: T) => void;
	tabs?: boolean;
}>) {
	const ref = useActiveInView(value);
	const active = Math.max(
		0,
		items.findIndex((item) => item.value === value),
	);
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.altKey || event.metaKey || event.ctrlKey) {
			return;
		}
		const target = arrowTarget(event.key, active, items.length);
		const next = target === null ? undefined : items[target];
		if (target === null || next === undefined) {
			return;
		}
		event.preventDefault();
		onChange(next.value);
		ref.current?.querySelectorAll<HTMLButtonElement>("button")[target]?.focus();
	};
	return (
		<div
			ref={ref}
			role={tabs ? "tablist" : "radiogroup"}
			aria-label={label}
			onKeyDown={onKeyDown}
			className="relative inline-flex max-w-full overflow-x-auto rounded-md border text-sm"
		>
			{items.map((item, index) => (
				<button
					key={item.value}
					type="button"
					role={tabs ? "tab" : "radio"}
					aria-checked={tabs ? undefined : value === item.value}
					aria-selected={tabs ? value === item.value : undefined}
					data-active={value === item.value}
					tabIndex={index === active ? 0 : -1}
					onClick={() => onChange(item.value)}
					className={cn(
						"flex shrink-0 items-center gap-1.5 px-2 py-1.5 whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:gap-2 sm:px-3",
						index > 0 && "border-l",
						value === item.value
							? "bg-muted font-medium"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{item.label}
					{item.count === undefined ? null : (
						<span className="text-muted-foreground tabular-nums">
							{formatCount(item.count)}
						</span>
					)}
				</button>
			))}
		</div>
	);
}

export function DataPager({
	summary,
	page,
	totalPages,
	onPage,
}: Readonly<{
	summary: string;
	page: number;
	totalPages: number;
	onPage: (page: number) => void;
}>) {
	return (
		<div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
			<span className="tabular-nums">{summary}</span>
			{totalPages > 1 ? (
				<nav aria-label="Сторінки" className="flex flex-wrap gap-1">
					{pageNumbers(page, totalPages).map((value, index) =>
						value === null ? (
							<span key={`gap-${index}`} className="px-2 py-1">
								…
							</span>
						) : (
							<Button
								key={value}
								size="sm"
								variant={value === page ? "default" : "outline"}
								aria-current={value === page ? "page" : undefined}
								onClick={() => onPage(value)}
								className="min-w-8 tabular-nums"
							>
								{value}
							</Button>
						),
					)}
				</nav>
			) : null}
		</div>
	);
}

export function DataProgress({
	value,
	label,
}: Readonly<{ value: number; label: string }>) {
	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(value)}
			className="h-1.5 overflow-hidden rounded-full bg-muted"
		>
			<div className="h-full bg-primary" style={{ width: `${value}%` }} />
		</div>
	);
}

export function DataOutcome({
	title,
	children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
	return (
		<div className="rounded-lg bg-muted px-5 py-4 text-sm">
			<p className="font-semibold">{title}</p>
			<div>{children}</div>
		</div>
	);
}

export function Kbd({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<kbd className="hidden rounded border border-current/40 px-1 text-xs leading-4 opacity-80 sm:inline">
			{children}
		</kbd>
	);
}
