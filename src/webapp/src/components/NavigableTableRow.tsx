import { type MouseEvent, useCallback } from "react";

import { type LinkProps, useNavigate } from "@tanstack/react-router";

import { TableRow } from "@/components/ui/Table";
import { cn } from "@/lib/utils";

interface NavigableTableRowProps<TTo extends string = string>
	extends Omit<React.ComponentProps<typeof TableRow>, "onClick"> {
	to: TTo;
	params?: LinkProps<"to", TTo, never>["params"];
	search?: LinkProps<"to", TTo, never>["search"];
	highlighted?: boolean;
}

export function NavigableTableRow<TTo extends string = string>({
	to,
	params,
	search,
	children,
	className,
	highlighted,
	...props
}: NavigableTableRowProps<TTo>) {
	const navigate = useNavigate();

	const handleClick = useCallback(
		(e: MouseEvent<HTMLTableRowElement>) => {
			const target = e.target as HTMLElement;
			if (
				target.tagName === "A" ||
				target.closest("a") ||
				target.tagName === "BUTTON" ||
				target.closest("button")
			) {
				return;
			}

			if (e.button === 1 || e.ctrlKey || e.metaKey) {
				const url = navigate.buildLocation({
					to,
					params: params as never,
					search: search as never,
				});
				globalThis.open(url.href, "_blank");
				return;
			}

			if (e.button === 0) {
				navigate({
					to,
					params: params as never,
					search: search as never,
				});
			}
		},
		[navigate, to, params, search],
	);

	const handleAuxClick = useCallback(
		(e: MouseEvent<HTMLTableRowElement>) => {
			if (e.button === 1) {
				e.preventDefault();
				handleClick(e);
			}
		},
		[handleClick],
	);

	return (
		<TableRow
			data-highlighted={highlighted ? true : undefined}
			className={cn(
				"group cursor-pointer",
				highlighted &&
					"bg-primary/5 border-l-2 border-l-primary hover:bg-primary/10",
				className,
			)}
			onClick={handleClick}
			onAuxClick={handleAuxClick}
			{...props}
		>
			{children}
		</TableRow>
	);
}
