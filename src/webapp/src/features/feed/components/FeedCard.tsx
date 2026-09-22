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
}

/** One card shell for every feed entry, in the strip and on `/feed`. */
export function FeedCard({
	badge,
	pinned,
	title,
	children,
	footer,
	className,
}: Readonly<FeedCardProps>) {
	return (
		<article
			className={cn(
				"flex h-full flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm",
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
			<h3 className="font-semibold leading-snug line-clamp-2">{title}</h3>
			{children}
			{footer && <div className="mt-auto">{footer}</div>}
		</article>
	);
}
