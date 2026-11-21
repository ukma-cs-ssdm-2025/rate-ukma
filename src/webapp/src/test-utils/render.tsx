import type { ReactElement, ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";

import { AuthProvider } from "@/lib/auth";
import { FeatureFlagsContext } from "@/lib/feature-flags/FeatureFlagsContext";

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
				<AuthProvider>
					<FeatureFlagsContext.Provider
						value={{
							flags: options?.flags ?? {},
							isReady: options?.flagsReady ?? true,
						}}
					>
						{children}
					</FeatureFlagsContext.Provider>
				</AuthProvider>
			</QueryClientProvider>
		);
	}

	return {
		...render(ui, { wrapper: Wrapper, ...options }),
		queryClient,
	};
}

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
				<AuthProvider>
					<FeatureFlagsContext.Provider value={{ flags: {}, isReady: true }}>
						{children}
					</FeatureFlagsContext.Provider>
				</AuthProvider>
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

// oxlint-disable-next-line import/export -- the custom render below replaces RTL's, as Testing Library's setup guide does
export * from "@testing-library/react";
export { renderWithProviders as render };
