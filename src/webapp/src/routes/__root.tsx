import { lazy, Suspense } from "react";

import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { HelmetProvider } from "react-helmet-async";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import type { HeaderNotifications } from "@/components/Header/HeaderNotificationsProvider";
import { HeaderNotificationsProvider } from "@/components/Header/HeaderNotificationsProvider";
import { Toaster } from "@/components/ui/Toaster";
import {
	MobileNotificationPanel,
	MobileNotificationRow,
} from "@/features/notifications/components/MobileNotificationPanel";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { RatingContinuationProvider } from "@/features/ratings/components/RatingContinuationProvider";
import { SentryUserSync } from "@/integrations/sentry/SentryUserSync";
import { AppMetadataDefaults } from "@/lib/app-metadata";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { FeatureFlagsProvider } from "@/lib/feature-flags/FeatureFlagsContext";

const TanStackRouterDevtools = import.meta.env.PROD
	? () => null
	: lazy(() =>
			import("@tanstack/react-router-devtools").then((m) => ({
				default: m.TanStackRouterDevtools,
			})),
		);

const headerNotifications: HeaderNotifications = {
	Bell: NotificationBell,
	MobilePanel: MobileNotificationPanel,
	MobileRow: MobileNotificationRow,
};

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
							<HeaderNotificationsProvider value={headerNotifications}>
								<RatingContinuationProvider>
									<NuqsAdapter>
										<Outlet />
									</NuqsAdapter>
									<Toaster />
								</RatingContinuationProvider>
							</HeaderNotificationsProvider>
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
