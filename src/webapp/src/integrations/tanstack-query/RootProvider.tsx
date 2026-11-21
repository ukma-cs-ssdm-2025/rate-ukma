import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { env } from "@/env";

const STALE_TIME = 5 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 3;
const MAX_RETRY_DELAY = 30_000;

function responseStatus(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null || !("response" in error)) {
		return undefined;
	}
	const { response } = error;
	if (
		typeof response !== "object" ||
		response === null ||
		!("status" in response) ||
		typeof response.status !== "number"
	) {
		return undefined;
	}
	return response.status;
}

export function shouldRetryQuery(
	failureCount: number,
	error: unknown,
): boolean {
	const errorStatus = responseStatus(error);
	if (errorStatus === 401 || errorStatus === 403) {
		return false;
	}
	if (errorStatus === undefined) {
		return false;
	}
	return failureCount < MAX_RETRY_ATTEMPTS;
}

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: STALE_TIME,
				retry: env.VITE_QUERY_RETRY === "off" ? false : shouldRetryQuery,
				retryDelay: (failureCount) =>
					Math.min(1000 * 2 ** failureCount, MAX_RETRY_DELAY),
			},
		},
	});
	return {
		queryClient,
	};
}

export function RootProvider({
	children,
	queryClient,
}: Readonly<{
	children: React.ReactNode;
	queryClient: QueryClient;
}>) {
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
