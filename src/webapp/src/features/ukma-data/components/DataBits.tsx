import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";
import { formatCount } from "../syncFormat";
import { arrowTarget, scrollToShow } from "../segmentScroll";

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
