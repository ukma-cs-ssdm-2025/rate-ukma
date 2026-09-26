import type * as React from "react";

import { Badge } from "@/components/ui/Badge";
import { getSemesterTermDisplay } from "@/features/courses/courseFormatting";
import { cn } from "@/lib/utils";

const TERM_CLASSES: Record<string, string> = {
	FALL: "bg-term-fall/12 text-term-fall",
	SPRING: "bg-term-spring/12 text-term-spring",
	SUMMER: "bg-term-summer/12 text-term-summer",
};

const TERM_DOTS: Record<string, string> = {
	FALL: "bg-term-fall",
	SPRING: "bg-term-spring",
	SUMMER: "bg-term-summer",
};

interface TermBadgeProps extends React.ComponentProps<typeof Badge> {
	readonly term: string;
	/** `dot` keeps the term colour to a dot, for rows of neutral fact badges. */
	readonly look?: "fill" | "dot";
}

export function TermBadge({
	term,
	look = "fill",
	className,
	children,
	...props
}: Readonly<TermBadgeProps>) {
	const key = term.toUpperCase();
	if (look === "dot") {
		return (
			<Badge
				variant="outline"
				className={cn("gap-1.5 border-transparent bg-muted", className)}
				{...props}
			>
				<span
					aria-hidden
					className={cn("size-1.5 rounded-full", TERM_DOTS[key])}
				/>
				{children ?? getSemesterTermDisplay(term)}
			</Badge>
		);
	}
	return (
		<Badge
			variant="outline"
			className={cn("border-transparent", TERM_CLASSES[key], className)}
			{...props}
		>
			{children ?? getSemesterTermDisplay(term)}
		</Badge>
	);
}
