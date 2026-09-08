import type { ReactNode } from "react";

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
	type AnyRouter,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";

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

/**
 * Build a memory-history router whose index route renders `ui`.
 *
 * The `/courses/$courseId` and `/explore` routes exist so links to those pages
 * resolve without navigation. Use `renderWithCustomRouter` when you need to
 * spy on `router.navigate` before rendering.
 */
export function createTestRouter(ui: ReactNode): AnyRouter {
	const rootRoute = createRootRoute();
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => <>{ui}</>,
	});
	const coursesRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/courses/$courseId",
	});
	const exploreRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/explore",
	});
	const routeTree = rootRoute.addChildren([
		indexRoute,
		coursesRoute,
		exploreRoute,
	]);
	return createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
}

/**
 * Render `ui` inside a real memory-history router.
 *
 * Components that use `Link` / `useNavigate` get a working router context
 * instead of a module mock. The router is loaded before the first render so
 * queries can stay synchronous.
 */
export async function renderWithRouter(ui: ReactNode) {
	return renderWithCustomRouter(createTestRouter(ui));
}

/** Render a pre-built router (e.g. one with `navigate` spied on). */
export async function renderWithCustomRouter(router: AnyRouter) {
	await router.load();
	return { ...render(<RouterProvider router={router} />), router };
}
