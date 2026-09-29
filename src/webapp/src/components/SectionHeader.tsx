import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
	readonly title: ReactNode;
	/** Rendered right after the title, e.g. a count Badge. */
	readonly meta?: ReactNode;
	readonly actions?: ReactNode;
	readonly className?: string;
}

export function SectionHeader({
	title,
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
				<h2 className="text-lg font-semibold tracking-tight">{title}</h2>
				{meta}
			</div>
			{actions ? (
				<div className="flex items-center gap-2">{actions}</div>
			) : null}
		</div>
	);
}
