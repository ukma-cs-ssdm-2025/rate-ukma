import { lazy, Suspense } from "react";

import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { HelmetProvider } from "react-helmet-async";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";
import { RatingContinuationProvider } from "@/features/ratings/components/RatingContinuationProvider";
import { SentryUserSync } from "@/integrations/sentry/SentryUserSync";
import { AppMetadataDefaults } from "@/lib/app-metadata";
import { AuthProvider } from "@/lib/auth";
import { FeatureFlagsProvider } from "@/lib/feature-flags";

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
					<FeatureFlagsProvider>
						<SentryUserSync />
						<ThemeProvider defaultTheme="system" storageKey="rate-ukma-theme">
							<RatingContinuationProvider>
								<NuqsAdapter>
									<Outlet />
								</NuqsAdapter>
								<Toaster />
							</RatingContinuationProvider>
						</ThemeProvider>
						<Suspense>
							<TanStackRouterDevtools position="bottom-left" />
						</Suspense>
					</FeatureFlagsProvider>
				</AuthProvider>
			</HelmetProvider>
		</ErrorBoundary>
	),
});
