import type * as React from "react";

import { Badge } from "@/components/ui/Badge";
import {
	getSemesterTermDisplay,
	parseSemesterTerm,
} from "@/features/courses/courseFormatting";
import type { SemesterTermEnum } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

const TERM_CLASSES = {
	FALL: "bg-term-fall/12 text-term-fall",
	SPRING: "bg-term-spring/12 text-term-spring",
	SUMMER: "bg-term-summer/12 text-term-summer",
} satisfies Record<SemesterTermEnum, string>;

function termClasses(term: string): string | undefined {
	const parsed = parseSemesterTerm(term);
	return parsed === null ? undefined : TERM_CLASSES[parsed];
}

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
			className={cn("border-transparent", termClasses(term), className)}
			{...props}
		>
			{children ?? getSemesterTermDisplay(term)}
		</Badge>
	);
}
