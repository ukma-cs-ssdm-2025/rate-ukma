import type { ReactNode } from "react";

interface MockLinkProps {
	to: string;
	params?: Record<string, string>;
	children: ReactNode;
	className?: string;
}

export function MockLink({
	to,
	params,
	children,
	className,
	...rest
}: MockLinkProps) {
	return (
		<a
			href={to}
			data-params={params ? JSON.stringify(params) : undefined}
			className={className}
			{...rest}
		>
			{children}
		</a>
	);
}
