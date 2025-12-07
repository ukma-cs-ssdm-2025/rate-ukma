import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";
import { AuthProvider } from "@/lib/auth";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	component: () => (
		<ErrorBoundary>
			<AuthProvider>
				<ThemeProvider defaultTheme="system" storageKey="rate-ukma-theme">
					<Outlet />
					<Toaster />
				</ThemeProvider>
				<TanStackRouterDevtools position="bottom-left" />
			</AuthProvider>
		</ErrorBoundary>
	),
});
