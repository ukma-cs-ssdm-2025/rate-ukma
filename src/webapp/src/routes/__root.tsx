import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import Layout from "../components/Layout";
import { ThemeProvider } from "../components/ThemeProvider";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	component: () => (
		<>
			<ThemeProvider defaultTheme="system" storageKey="rate-ukma-theme">
				<Layout>
					<Outlet />
				</Layout>
			</ThemeProvider>
			<TanStackRouterDevtools position="bottom-left" />
		</>
	),
});
