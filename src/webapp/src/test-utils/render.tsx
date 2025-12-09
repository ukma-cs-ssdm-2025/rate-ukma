import type { ReactElement, ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render, renderHook } from "@testing-library/react";

import { AuthProvider } from "@/lib/auth";

/**
 * Custom render function that wraps components with necessary providers
 * Use this instead of @testing-library/react's render for tests that need API/query context
 */
export function renderWithProviders(
	ui: ReactElement,
	options?: Readonly<
		RenderOptions & {
			queryClient?: QueryClient;
		}
	>,
) {
	const queryClient =
		options?.queryClient ??
		new QueryClient({
			defaultOptions: {
				queries: {
					gcTime: Number.POSITIVE_INFINITY,
				},
			},
		});

	function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
		return (
			<QueryClientProvider client={queryClient}>
				<AuthProvider>{children}</AuthProvider>
			</QueryClientProvider>
		);
	}

	return {
		...render(ui, { wrapper: Wrapper, ...options }),
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
	const queryClient =
		options?.queryClient ??
		new QueryClient({
			defaultOptions: {
				queries: {
					gcTime: Number.POSITIVE_INFINITY,
				},
			},
		});

	function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
		return (
			<QueryClientProvider client={queryClient}>
				<AuthProvider>{children}</AuthProvider>
			</QueryClientProvider>
		);
	}

	return {
		...renderHook(renderCallback, {
			wrapper: Wrapper,
			initialProps: options?.initialProps,
		}),
		queryClient,
	};
}

export * from "@testing-library/react";
export { renderWithProviders as render };
