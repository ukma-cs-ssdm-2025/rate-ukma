import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Custom render function that wraps components with necessary providers
 * Use this instead of @testing-library/react's render for tests that need API/query context
 */
export function renderWithProviders(
	ui: ReactElement,
	options?: RenderOptions & {
		queryClient?: QueryClient;
	},
) {
	const queryClient =
		options?.queryClient ??
		new QueryClient({
			defaultOptions: {
				queries: {
					retry: false, // Disable retries in tests
					gcTime: Number.POSITIVE_INFINITY, // Keep data in cache
				},
				mutations: {
					retry: false,
				},
			},
		});

	function Wrapper({ children }: { children: React.ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	}

	return {
		...render(ui, { wrapper: Wrapper, ...options }),
		queryClient,
	};
}

// Re-export everything from testing library
export * from "@testing-library/react";
export { renderWithProviders as render };
