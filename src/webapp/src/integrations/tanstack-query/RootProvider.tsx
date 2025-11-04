import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function getContext() {
	const queryClient = new QueryClient();
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
