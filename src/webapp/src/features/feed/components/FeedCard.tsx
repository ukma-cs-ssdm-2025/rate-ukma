import type { ReactNode } from "react";

import { Pin } from "lucide-react";

import { cn } from "@/lib/utils";

interface FeedCardProps {
	readonly pinned?: boolean;
	readonly title: ReactNode;
	readonly children?: ReactNode;
	readonly footer?: ReactNode;
	readonly className?: string;
	/** `card` is the strip tile; `banner` keeps the roomy `/feed` layout. */
	readonly variant?: "card" | "banner";
}

/**
 * One card shell for every feed entry, in the strip and on `/feed`.
 * The course (or announcement) title leads so each item scans as
 * course → scores → text → meta; the kind badge lives in the footer meta.
 */
export function FeedCard({
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
			<div className="flex items-start justify-between gap-2">
				<h3
					className={cn(
						"font-semibold leading-snug line-clamp-2",
						!isBanner && "text-sm",
					)}
				>
					{title}
				</h3>
				{pinned && (
					<span
						role="img"
						aria-label="Закріплено"
						className="mt-1 inline-flex shrink-0 text-muted-foreground"
					>
						<Pin className="size-3.5" aria-hidden />
					</span>
				)}
			</div>
			{children}
			{footer && <div className="mt-auto">{footer}</div>}
		</article>
	);
}
