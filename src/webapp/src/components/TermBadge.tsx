import type * as React from "react";

import { Badge } from "@/components/ui/Badge";
import { getSemesterTermDisplay } from "@/features/courses/courseFormatting";
import { cn } from "@/lib/utils";

const TERM_CLASSES: Record<string, string> = {
	FALL: "bg-term-fall/12 text-term-fall",
	SPRING: "bg-term-spring/12 text-term-spring",
	SUMMER: "bg-term-summer/12 text-term-summer",
};

interface TermBadgeProps extends React.ComponentProps<typeof Badge> {
	readonly term: string;
}

export function TermBadge({
	term,
	className,
	children,
	...props
}: Readonly<TermBadgeProps>) {
	return (
		<Badge
			variant="outline"
			className={cn(
				"border-transparent",
				TERM_CLASSES[term.toUpperCase()],
				className,
			)}
			{...props}
		>
			{children ?? getSemesterTermDisplay(term)}
		</Badge>
	);
}
