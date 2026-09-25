import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";
import { Pin } from "lucide-react";

import { cn } from "@/lib/utils";

export type FeedTone = "primary" | "success" | "muted" | "destructive";

const TONE = {
	primary: { text: "text-primary", rail: "bg-primary", icon: "bg-primary/10" },
	success: { text: "text-success", rail: "bg-success", icon: "bg-success/10" },
	muted: {
		text: "text-muted-foreground",
		rail: "bg-muted-foreground/60",
		icon: "bg-muted",
	},
	destructive: {
		text: "text-destructive",
		rail: "bg-destructive",
		icon: "bg-destructive/10",
	},
} as const satisfies Record<
	FeedTone,
	{ text: string; rail: string; icon: string }
>;

interface FeedCardProps {
	readonly kind: {
		readonly label: string;
		readonly icon: LucideIcon;
		readonly tone: FeedTone;
	};
	readonly pinned?: boolean;
	readonly title: ReactNode;
	readonly children?: ReactNode;
	readonly footer?: ReactNode;
	readonly className?: string;
	/** `card` is the compact strip tile; `banner` is the roomier `/feed` card. */
	readonly variant?: "card" | "banner";
}

/**
 * One shell for every feed entry. The kind leads, colour-coded with a rail, so
 * a review, a comment and an announcement tell apart before reading them.
 */
export function FeedCard({
	kind,
	pinned,
	title,
	children,
	footer,
	className,
	variant = "card",
}: Readonly<FeedCardProps>) {
	const isBanner = variant === "banner";
	const tone = TONE[kind.tone];
	const Icon = kind.icon;
	return (
		<article
			className={cn(
				"relative flex h-full flex-col overflow-hidden rounded-xl border bg-card text-card-foreground",
				isBanner ? "gap-2.5 p-5 pl-6" : "gap-1.5 py-2.5 pr-3 pl-4 shadow-sm",
				className,
			)}
		>
			<span
				className={cn("absolute inset-y-0 left-0 w-1", tone.rail)}
				aria-hidden
			/>
			<div className="flex items-center justify-between gap-2">
				<span
					className={cn(
						"inline-flex items-center gap-2 text-xs font-medium",
						tone.text,
					)}
				>
					<span
						className={cn(
							"flex size-6 items-center justify-center rounded-full",
							tone.icon,
						)}
						aria-hidden
					>
						<Icon className="size-3.5" />
					</span>
					{kind.label}
				</span>
				{pinned && (
					<span
						role="img"
						aria-label="Закріплено"
						className="inline-flex shrink-0 text-muted-foreground"
					>
						<Pin className="size-3.5" aria-hidden />
					</span>
				)}
			</div>
			<h3
				className={cn(
					"font-semibold leading-snug line-clamp-2",
					!isBanner && "text-sm",
				)}
			>
				{title}
			</h3>
			{children}
			{footer && <div className="mt-auto">{footer}</div>}
		</article>
	);
}
