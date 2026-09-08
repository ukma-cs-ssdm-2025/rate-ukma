/**
 * Minimal React Query query-result fixture.
 *
 * Consumers under test only read the listed fields; everything else stays at
 * its neutral default. Orval's generated hooks return a result intersected
 * with a branded `queryKey`, so call sites keep a single
 * `as ReturnType<typeof hook>` boundary cast (with a SAFETY comment).
 */
export interface QueryStub<TData> {
	data: TData;
	isError: boolean;
	isFetching: boolean;
	isLoading: boolean;
	isSuccess: boolean;
	refetch: (...args: any[]) => any;
}

export function createQueryStub<TData>(
	data: TData,
	overrides: Partial<QueryStub<TData>> = {},
): QueryStub<TData> {
	return {
		data,
		isError: false,
		isFetching: false,
		isLoading: false,
		isSuccess: true,
		refetch: () => undefined,
		...overrides,
	};
}
