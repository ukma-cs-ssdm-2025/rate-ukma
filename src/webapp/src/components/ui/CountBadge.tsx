import type * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// 11px digits are 8px tall, leaving 4px above and below in the 16px badge.
// At 10px they are 7px tall, so the odd spare pixel lands on top.
const countBadgeVariants = cva(
	"flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[11px] leading-none font-bold tabular-nums",
	{
		variants: {
			tone: {
				// Something went wrong or is unread.
				destructive: "bg-destructive text-destructive-foreground",
				// Something is waiting on the user: courses to rate.
				primary: "bg-primary text-primary-foreground",
			},
			placement: {
				// Pinned to the top right of an icon button.
				corner: "absolute -top-0.5 -right-0.5",
				// Beside a label, in the text flow.
				inline: "relative",
			},
		},
		defaultVariants: {
			tone: "destructive",
			placement: "corner",
		},
	},
);

interface CountBadgeProps
	extends
		Omit<React.ComponentProps<"span">, "children">,
		VariantProps<typeof countBadgeVariants> {
	readonly count: number;
	/** Shown as "{max}+" above it. */
	readonly max?: number;
	/** Three slow pings to draw the eye once; hidden for reduced motion. */
	readonly pulse?: boolean;
}

/** The small number on the header's icons and links; nothing at zero. */
export function CountBadge({
	count,
	max = 99,
	pulse = false,
	tone,
	placement,
	className,
	...props
}: Readonly<CountBadgeProps>) {
	if (count <= 0) return null;
	return (
		<span
			data-slot="count-badge"
			className={cn(countBadgeVariants({ tone, placement }), className)}
			{...props}
		>
			{pulse ? (
				<span
					aria-hidden="true"
					className="absolute inset-0 animate-ping rounded-full bg-inherit opacity-60 [animation-iteration-count:3] motion-reduce:hidden"
				/>
			) : null}
			{/* Trimmed to the digits' own height: line boxes keep room for
			    descenders, which digits lack, so a plain box sits them high. */}
			<span className="relative [text-box:trim-both_cap_alphabetic]">
				{count > max ? `${max}+` : count}
			</span>
		</span>
	);
}
