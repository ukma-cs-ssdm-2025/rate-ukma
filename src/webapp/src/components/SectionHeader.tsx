import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
	readonly title: ReactNode;
	readonly icon?: LucideIcon;
	/** Rendered right after the title, e.g. a count Badge. */
	readonly meta?: ReactNode;
	readonly actions?: ReactNode;
	readonly className?: string;
}

export function SectionHeader({
	title,
	icon: Icon,
	meta,
	actions,
	className,
}: Readonly<SectionHeaderProps>) {
	return (
		<div
			className={cn(
				"flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
				className,
			)}
		>
			<div className="flex items-center gap-2">
				{Icon ? (
					<Icon aria-hidden className="size-5 text-muted-foreground" />
				) : null}
				<h2 className="text-lg font-semibold tracking-tight">{title}</h2>
				{meta}
			</div>
			{actions ? (
				<div className="flex items-center gap-2">{actions}</div>
			) : null}
		</div>
	);
}
