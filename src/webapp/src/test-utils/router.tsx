import type { ReactNode } from "react";

interface MockLinkProps {
	to: string;
	params?: Record<string, string>;
	search?: unknown;
	children: ReactNode;
	className?: string;
}

export function MockLink({
	to,
	params,
	search,
	children,
	className,
	...rest
}: MockLinkProps) {
	return (
		<a
			href={to}
			data-params={params ? JSON.stringify(params) : undefined}
			data-search={search === undefined ? undefined : JSON.stringify(search)}
			className={className}
			{...rest}
		>
			{children}
		</a>
	);
}
