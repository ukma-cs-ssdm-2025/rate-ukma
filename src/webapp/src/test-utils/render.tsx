import type { ReactElement } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";

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
					gcTime: Number.POSITIVE_INFINITY, // Keep data in cache
				},
			},
		});

	function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	}

	return {
		...render(ui, { wrapper: Wrapper, ...options }),
		queryClient,
	};
}

export * from "@testing-library/react";
export { renderWithProviders as render };
