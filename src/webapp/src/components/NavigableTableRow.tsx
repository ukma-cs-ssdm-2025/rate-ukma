import { type KeyboardEvent, type MouseEvent, useCallback } from "react";

import { useNavigate, useRouter } from "@tanstack/react-router";

import { TableRow } from "@/components/ui/Table";
import { cn } from "@/lib/utils";

interface NavigableTableRowProps
	extends Omit<React.ComponentProps<typeof TableRow>, "onClick" | "onKeyDown"> {
	to: string;
	params?: Record<string, string>;
	search?: Record<string, unknown>;
	highlighted?: boolean;
}

export function NavigableTableRow({
	to,
	params,
	search,
	children,
	className,
	highlighted,
	...props
}: NavigableTableRowProps) {
	const navigate = useNavigate();
	const router = useRouter();

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
				e.preventDefault();
				// Type assertion needed due to TanStack Router's complex generic types
				const location = router.buildLocation({
					to,
					params,
					search,
				} as never);
				globalThis.open(location.href, "_blank");
				return;
			}

			if (e.button === 0 && !e.shiftKey && !e.altKey) {
				e.preventDefault();
				// Type assertion needed due to TanStack Router's complex generic types
				navigate({
					to,
					params,
					search,
				} as never);
			}
		},
		[navigate, router, to, params, search],
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTableRowElement>) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				// Type assertion needed due to TanStack Router's complex generic types
				navigate({
					to,
					params,
					search,
				} as never);
			}
		},
		[navigate, to, params, search],
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
			onAuxClick={handleClick}
			onKeyDown={handleKeyDown}
			tabIndex={0}
			role="link"
			{...props}
		>
			{children}
		</TableRow>
	);
}
