import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
	readonly title: ReactNode;
	readonly description?: ReactNode;
	readonly icon?: LucideIcon;
	readonly actions?: ReactNode;
	readonly className?: string;
}

export function PageHeader({
	title,
	description,
	icon: Icon,
	actions,
	className,
}: Readonly<PageHeaderProps>) {
	return (
		<header
			className={cn(
				"flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
				className,
			)}
		>
			<div>
				<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
					{Icon ? (
						<Icon
							aria-hidden
							className="mr-2 inline size-6 text-muted-foreground"
						/>
					) : null}
					{title}
				</h1>
				{description ? (
					<p className="mt-1 text-muted-foreground">{description}</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex items-center gap-4">{actions}</div>
			) : null}
		</header>
	);
}
