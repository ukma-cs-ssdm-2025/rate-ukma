import type { ReactNode } from "react";

import { Pin } from "lucide-react";

import { cn } from "@/lib/utils";

interface FeedCardProps {
	readonly badge: ReactNode;
	readonly pinned?: boolean;
	readonly title: ReactNode;
	readonly children?: ReactNode;
	readonly footer?: ReactNode;
	readonly className?: string;
	/** `card` is the strip tile; `banner` keeps the roomy `/feed` layout. */
	readonly variant?: "card" | "banner";
}

/** One card shell for every feed entry, in the strip and on `/feed`. */
export function FeedCard({
	badge,
	pinned,
	title,
	children,
	footer,
	className,
	variant = "card",
}: Readonly<FeedCardProps>) {
	const isBanner = variant === "banner";
	return (
		<article
			className={cn(
				"flex h-full flex-col rounded-xl border bg-card text-card-foreground shadow-sm",
				isBanner ? "gap-3 p-4" : "gap-1.5 px-3 py-2.5",
				className,
			)}
		>
			<div className="flex items-center justify-between gap-2">
				{badge}
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
