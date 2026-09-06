import type { ReactNode } from "react";

interface MockLinkProps {
	to: string;
	params?: Record<string, string>;
	children: ReactNode;
	className?: string;
}

/**
 * TanStack Router's `<Link>` rendered as a plain anchor, for component tests
 * that don't mount a real router. Shared so the mock isn't duplicated per file:
 *
 *   vi.mock("@tanstack/react-router", async () => ({
 *     ...(await vi.importActual("@tanstack/react-router")),
 *     Link: (await import("@/test-utils/router")).MockLink,
 *   }));
 */
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
