import type {
	MutateOptions,
	UseMutateAsyncFunction,
	UseMutationResult,
} from "@tanstack/react-query";
import { vi } from "vitest";

/**
 * A faithful mutation success result.
 *
 * Mirrors the success variant of TanStack's `MutationObserverResult`:
 * discriminants (`status`, `isSuccess`, `isError`, `isIdle`, `isPaused`) are
 * fixed literals, so a fixture cannot claim conflicting states. Tests
 * override only `mutateAsync` (and optionally `isPending`).
 *
 * `mutate`/`mutateAsync` are typed with `any` args because the vendored lint
 * rules ban `unknown` params and no narrower signature accepts an untyped
 * `vi.fn()` from the test; the args are never inspected by the consumers
 * under test.
 *
 * Orval's generated hooks return
 * `UseMutationResult<...> & { queryKey: DataTag<...> }`, where the branded
 * `queryKey` cannot be produced generically — so call sites keep a single
 * `as ReturnType<typeof hook>` boundary cast (with a SAFETY comment) after
 * building the fixture with this factory.
 */
export interface MutationStubOptions<
	TData = unknown,
	TVariables = unknown,
	TError = Error,
	TContext = unknown,
> {
	mutateAsync?:
		| ((
				variables: TVariables,
				options?: MutateOptions<TData, TError, TVariables, TContext>,
		  ) => Promise<TData>)
		| ReturnType<typeof vi.fn>;
}

function toMutateAsync<TData, TVariables, TError, TContext>(
	mutateAsync: MutationStubOptions<
		TData,
		TVariables,
		TError,
		TContext
	>["mutateAsync"],
): UseMutateAsyncFunction<TData, TError, TVariables, TContext> {
	if (mutateAsync === undefined) {
		// SAFETY: the default mock resolves undefined; consumers under test
		// never read its result.
		return vi.fn() as UseMutateAsyncFunction<
			TData,
			TError,
			TVariables,
			TContext
		>;
	}
	// SAFETY: the caller's mock or fn already satisfies the mutate interface.
	return mutateAsync as UseMutateAsyncFunction<
		TData,
		TError,
		TVariables,
		TContext
	>;
}

export function createMutationStub<
	TData = unknown,
	TVariables = unknown,
	TError = Error,
	TContext = unknown,
>({
	mutateAsync,
}: MutationStubOptions<
	TData,
	TVariables,
	TError,
	TContext
> = {}): UseMutationResult<TData, TError, TVariables, TContext> {
	return {
		context: undefined,
		// SAFETY: consumers under test only read mutateAsync/isPending; the
		// resolved mutation data is never inspected.
		data: undefined as TData,
		error: null,
		failureCount: 0,
		failureReason: null,
		isError: false,
		isIdle: false,
		isPaused: false,
		isPending: false,
		isSuccess: true,
		mutate: vi.fn(),
		mutateAsync: toMutateAsync(mutateAsync),
		reset: vi.fn(),
		status: "success",
		submittedAt: 0,
		// SAFETY: mutation variables are only fed to the (stubbed) mutate fn.
		variables: undefined as TVariables,
	};
}
