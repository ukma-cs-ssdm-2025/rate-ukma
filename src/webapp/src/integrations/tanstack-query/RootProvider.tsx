import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: STALE_TIME,
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
