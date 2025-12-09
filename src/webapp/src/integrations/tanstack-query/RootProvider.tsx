import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const MAX_RETRY_DELAY = 30_000; // 30 seconds cap

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: STALE_TIME,
				retry: (failureCount, error) => {
					const errorStatus = (error as { response?: { status?: number } })
						?.response?.status;
					// Never retry on 401 (unauthorized) or 403 (forbidden)
					if (errorStatus === 401 || errorStatus === 403) {
						return false;
					}
					// Exponential backoff for other errors, up to MAX_RETRY_ATTEMPTS
					return failureCount < MAX_RETRY_ATTEMPTS;
				},
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
