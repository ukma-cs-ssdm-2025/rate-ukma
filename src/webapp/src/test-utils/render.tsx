import type { ReactElement, ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render, renderHook } from "@testing-library/react";

import { AuthProvider } from "@/lib/auth";
import { FeatureFlagsContext } from "@/lib/feature-flags/FeatureFlagsContext";

export function createTestQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				gcTime: Number.POSITIVE_INFINITY,
			},
		},
	});
}

/**
 * Provider stack shared by the test renders below. Nest it manually when a
 * test also needs its own wrapper (e.g. a router from `test-utils/router`).
 */
export function Providers({
	children,
	queryClient = createTestQueryClient(),
	flags = {},
	flagsReady = true,
}: Readonly<{
	children: ReactNode;
	queryClient?: QueryClient;
	flags?: Record<string, boolean>;
	flagsReady?: boolean;
}>) {
	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<FeatureFlagsContext.Provider value={{ flags, isReady: flagsReady }}>
					{children}
				</FeatureFlagsContext.Provider>
			</AuthProvider>
		</QueryClientProvider>
	);
}

/**
 * Custom render function that wraps components with necessary providers
 * Use this instead of @testing-library/react's render for tests that need API/query context
 *
 * Pass `flags` to control feature flags under test (defaults to all-off).
 */
export function renderWithProviders(
	ui: ReactElement,
	options?: Readonly<
		RenderOptions & {
			queryClient?: QueryClient;
			flags?: Record<string, boolean>;
			flagsReady?: boolean;
		}
	>,
) {
	const queryClient = options?.queryClient ?? createTestQueryClient();

	return {
		...render(ui, {
			wrapper: ({ children }) => (
				<Providers
					queryClient={queryClient}
					flags={options?.flags}
					flagsReady={options?.flagsReady}
				>
					{children}
				</Providers>
			),
			...options,
		}),
		queryClient,
	};
}

/**
 * Custom renderHook function that wraps hooks with necessary providers
 * Use this for testing hooks that depend on React Query
 */
export function renderHookWithProviders<Result, Props>(
	renderCallback: (initialProps: Props) => Result,
	options?: Readonly<{
		queryClient?: QueryClient;
		initialProps?: Props;
	}>,
) {
	const queryClient = options?.queryClient ?? createTestQueryClient();

	return {
		...renderHook(renderCallback, {
			wrapper: ({ children }) => (
				<Providers queryClient={queryClient}>{children}</Providers>
			),
			initialProps: options?.initialProps,
		}),
		queryClient,
	};
}

export * from "@testing-library/react";
export { renderWithProviders as render };
