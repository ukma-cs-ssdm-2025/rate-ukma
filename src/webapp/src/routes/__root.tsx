import { lazy, Suspense } from "react";

import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { HelmetProvider } from "react-helmet-async";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";
import { SentryUserSync } from "@/integrations/sentry/SentryUserSync";
import { AppMetadataDefaults } from "@/lib/app-metadata";
import { AuthProvider } from "@/lib/auth";

const TanStackRouterDevtools = import.meta.env.PROD
	? () => null
	: lazy(() =>
			import("@tanstack/react-router-devtools").then((m) => ({
				default: m.TanStackRouterDevtools,
			})),
		);

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	component: () => (
		<ErrorBoundary>
			<HelmetProvider>
				<AppMetadataDefaults />
				<AuthProvider>
					<SentryUserSync />
					<ThemeProvider defaultTheme="system" storageKey="rate-ukma-theme">
						<NuqsAdapter>
							<Outlet />
						</NuqsAdapter>
						<Toaster />
					</ThemeProvider>
					<Suspense>
						<TanStackRouterDevtools position="bottom-left" />
					</Suspense>
				</AuthProvider>
			</HelmetProvider>
		</ErrorBoundary>
	),
});
