import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";
import { Pin } from "lucide-react";

import { cn } from "@/lib/utils";

export type FeedTone = "primary" | "muted" | "destructive";

const TONE = {
	primary: {
		icon: "bg-primary/10 text-primary",
		rail: "bg-primary",
		surface: "border-primary/20 bg-primary/5",
	},
	muted: {
		icon: "bg-muted text-muted-foreground",
		rail: "bg-muted-foreground/60",
		surface: "bg-accent",
	},
	destructive: {
		icon: "bg-destructive/10 text-destructive",
		rail: "bg-destructive",
		surface: "border-destructive/20 bg-destructive/5",
	},
} as const satisfies Record<
	FeedTone,
	{ icon: string; rail: string; surface: string }
>;

interface FeedCardProps {
	readonly kind: {
		readonly label: string;
		readonly icon: LucideIcon;
		readonly tone: FeedTone;
	};
	readonly pinned?: boolean;
	/** Tints the whole card with the kind colour and adds a rail; kept for announcements so they stand out from the review stream. */
	readonly tinted?: boolean;
	readonly title: ReactNode;
	readonly children?: ReactNode;
	readonly footer?: ReactNode;
	readonly className?: string;
	/** `card` is the compact strip tile; `banner` is the roomier `/feed` card. */
	readonly variant?: "card" | "banner";
}

/**
 * One shell for every feed entry. Only the kind icon carries colour on plain
 * cards; tinted cards spend the colour on the whole surface instead.
 */
export function FeedCard({
	kind,
	pinned,
	tinted,
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
				"relative flex h-full flex-col overflow-hidden rounded-xl border text-card-foreground",
				tinted ? tone.surface : "bg-card",
				isBanner ? "gap-2.5 p-5" : "gap-1.5 px-3.5 py-2.5 shadow-sm",
				tinted && (isBanner ? "pl-6" : "pl-4.5"),
				className,
			)}
		>
			{tinted && (
				<span
					className={cn("absolute inset-y-0 left-0 w-1", tone.rail)}
					aria-hidden
				/>
			)}
			<div className="flex items-center justify-between gap-2">
				<span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
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
