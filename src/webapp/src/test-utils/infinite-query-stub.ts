import { vi } from "vitest";

/**
 * A faithful infinite-query success result.
 *
 * The stub mirrors the success variant of TanStack's
 * `InfiniteQueryObserverResult`: discriminants (`status`, `isSuccess`,
 * `isError`, ...) are fixed literals, so a fixture cannot accidentally claim
 * conflicting states. Tests override only the fields they assert on (data,
 * hasNextPage, isFetchingNextPage, isLoading).
 *
 * `fetchNextPage`/`refetch` are typed `(...args: any[]) => any` because the
 * vendored lint rules ban `unknown` params/returns and no narrower signature
 * accepts `vi.fn()`; the args are never inspected by the consumers under
 * test.
 *
 * Orval's generated hooks return
 * `UseInfiniteQueryResult<...> & { queryKey: DataTag<...> }`, where the
 * branded `queryKey` cannot be produced generically — so call sites keep a
 * single `as ReturnType<typeof hook>` boundary cast (with a SAFETY comment)
 * after building the fixture with this factory.
 */
export interface InfiniteQueryStub<TData = unknown> {
	data: TData | undefined;
	dataUpdatedAt: number;
	error: null;
	errorUpdatedAt: number;
	errorUpdateCount: number;
	failureCount: number;
	failureReason: null;
	fetchNextPage: (...args: any[]) => any;
	fetchPreviousPage: (...args: any[]) => any;
	fetchStatus: "idle" | "fetching" | "paused";
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	isEnabled: boolean;
	isError: false;
	isFetched: boolean;
	isFetchedAfterMount: boolean;
	isFetchNextPageError: false;
	isFetching: boolean;
	isFetchingNextPage: boolean;
	isFetchPreviousPageError: false;
	isFetchingPreviousPage: boolean;
	isInitialLoading: boolean;
	isLoading: boolean;
	isLoadingError: false;
	isPaused: boolean;
	isPending: boolean;
	isPlaceholderData: false;
	isRefetchError: false;
	isRefetching: boolean;
	isStale: boolean;
	isSuccess: true;
	promise: Promise<any>;
	refetch: (...args: any[]) => any;
	status: "success";
}

export function createInfiniteQueryStub<TData>(
	overrides: Partial<InfiniteQueryStub<TData>> = {},
): InfiniteQueryStub<TData> {
	return {
		data: undefined,
		dataUpdatedAt: 0,
		error: null,
		errorUpdatedAt: 0,
		errorUpdateCount: 0,
		failureCount: 0,
		failureReason: null,
		fetchNextPage: vi.fn(),
		fetchPreviousPage: vi.fn(),
		fetchStatus: "idle",
		hasNextPage: false,
		hasPreviousPage: false,
		isEnabled: true,
		isError: false,
		isFetched: true,
		isFetchedAfterMount: true,
		isFetchNextPageError: false,
		isFetching: false,
		isFetchingNextPage: false,
		isFetchPreviousPageError: false,
		isFetchingPreviousPage: false,
		isInitialLoading: false,
		isLoading: false,
		isLoadingError: false,
		isPaused: false,
		isPending: false,
		isPlaceholderData: false,
		isRefetchError: false,
		isRefetching: false,
		isStale: false,
		isSuccess: true,
		promise: Promise.resolve(undefined),
		refetch: vi.fn(),
		status: "success",
		...overrides,
	};
}
